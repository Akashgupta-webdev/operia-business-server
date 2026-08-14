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

  const representation = {
    ...record,
    id: record._id.toString(),
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
