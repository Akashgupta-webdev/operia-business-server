import mongoose from "mongoose";

import Document from "../../common/models/document.model.js";
import Payment from "../../common/models/payment.model.js";
import Reminder from "../../common/models/reminder.model.js";
import Service from "../../common/models/service.model.js";
import Company from "../../company/models/company.model.js";
import {
  ClientNotFoundError,
  ClientServiceNotFoundError,
} from "../errors/client.error.js";
import Client from "../models/client.model.js";

const createOne = async (Model, data, session) => {
  const [record] = await Model.create([data], { session });
  return record;
};

export const createClientWithService = async (payload, uploads) => {
  const session = await mongoose.startSession();
  let result;

  try {
    await session.withTransaction(async () => {
      const client = await createOne(Client, payload.client, session);
      const company = payload.company
        ? await createOne(
            Company,
            { ...payload.company, client: client._id },
            session
          )
        : null;
      const service = await createOne(
        Service,
        {
          ...payload.service,
          client: client._id,
          company: company?._id,
        },
        session
      );
      const referenceFields = {
        service: service._id,
        company: company?._id,
      };
      const documents = uploads.length
        ? await Document.create(
            uploads.map(({ documentUrl }) => ({
              ...referenceFields,
              documentUrl,
            })),
            { session }
          )
        : [];
      const payment = payload.payment
        ? await createOne(
            Payment,
            { ...payload.payment, ...referenceFields },
            session
          )
        : null;
      const reminder = payload.reminder
        ? await createOne(
            Reminder,
            { ...payload.reminder, ...referenceFields },
            session
          )
        : null;

      result = { client, company, service, documents, payment, reminder };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

const toRepresentation = (record) => {
  if (!record) {
    return null;
  }

  const source = typeof record.toObject === "function"
    ? record.toObject({ flattenMaps: true })
    : record;
  const representation = {
    ...source,
    id: source._id.toString(),
  };
  delete representation._id;
  return representation;
};

export const getClientService = async (clientId, serviceId) => {
  const client = await Client.findOne({ clientId }).lean().exec();

  if (!client) {
    throw new ClientNotFoundError();
  }

  const service = await Service.findOne({
    _id: serviceId,
    client: client._id,
  })
    .lean()
    .exec();

  if (!service) {
    throw new ClientServiceNotFoundError();
  }

  const companyFilter = service.company
    ? { _id: service.company, client: client._id }
    : null;
  const [company, documents, payment, reminder] = await Promise.all([
    companyFilter
      ? Company.findOne(companyFilter).lean().exec()
      : Promise.resolve(null),
    Document.find({ service: service._id })
      .sort({ createdAt: -1, _id: 1 })
      .lean()
      .exec(),
    Payment.findOne({ service: service._id })
      .sort({ paymentDate: -1, _id: 1 })
      .lean()
      .exec(),
    Reminder.findOne({ service: service._id })
      .sort({ createdAt: -1, _id: 1 })
      .lean()
      .exec(),
  ]);

  return {
    client: toRepresentation(client),
    company: toRepresentation(company),
    service: toRepresentation(service),
    documents: documents.map(toRepresentation),
    payment: toRepresentation(payment),
    reminder: toRepresentation(reminder),
  };
};

export const listServicesByClientMongoId = async (
  clientMongoId,
  { page, limit }
) => {
  const clientExists = await Client.exists({ _id: clientMongoId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  const filter = { client: clientMongoId };
  const skip = (page - 1) * limit;
  const [services, total] = await Promise.all([
    Service.find(filter)
      .sort({ createdAt: -1, _id: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
      .exec(),
    Service.countDocuments(filter).exec(),
  ]);
  const serviceIds = services.map(({ _id }) => _id);
  const companyIds = [
    ...new Set(
      services
        .map(({ company }) => company?.toString())
        .filter(Boolean)
    ),
  ];
  const [companies, payments] = await Promise.all([
    companyIds.length
      ? Company.find({
          _id: { $in: companyIds },
          client: clientMongoId,
        })
          .lean()
          .exec()
      : Promise.resolve([]),
    serviceIds.length
      ? Payment.find({ service: { $in: serviceIds } })
          .sort({ paymentDate: -1, _id: 1 })
          .lean()
          .exec()
      : Promise.resolve([]),
  ]);
  const companyById = new Map(
    companies.map((company) => [company._id.toString(), company])
  );
  const latestPaymentByServiceId = new Map();

  for (const payment of payments) {
    const paymentServiceId = payment.service.toString();
    if (!latestPaymentByServiceId.has(paymentServiceId)) {
      latestPaymentByServiceId.set(paymentServiceId, payment);
    }
  }

  return {
    services: services.map((service) => ({
      ...toRepresentation(service),
      company: service.company
        ? toRepresentation(companyById.get(service.company.toString()))
        : null,
      payment: toRepresentation(
        latestPaymentByServiceId.get(service._id.toString())
      ),
    })),
    page: {
      page,
      limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    },
  };
};

export const editServiceByClientMongoId = async (
  clientMongoId,
  serviceId,
  changes
) => {
  const clientExists = await Client.exists({ _id: clientMongoId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  const service = await Service.findOne({
    _id: serviceId,
    client: clientMongoId,
  }).exec();

  if (!service) {
    throw new ClientServiceNotFoundError();
  }

  service.set(changes);
  await service.save();

  return toRepresentation(service);
};
