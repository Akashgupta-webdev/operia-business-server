import logger from "../../../logger/index.js";
import { ClientNotFoundError } from "../errors/client.error.js";
import Client from "../models/client.model.js";

const CLIENT_SUMMARY_FIELDS =
  "_id clientId name emiratesIdNumber emailAddress mobileNumber whatsappNumber clientStatus";

const toClientSummary = (client) => ({
  _id: client._id,
  clientId: client.clientId,
  name: client.name,
  emiratesIdNumber: client.emiratesIdNumber ?? null,
  emailAddress: client.emailAddress ?? null,
  mobileNumber: client.mobileNumber ?? null,
  whatsappNumber: client.whatsappNumber ?? null,
  clientStatus: client.clientStatus,
});

const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");

const buildClientSearchFilter = (search) => {
  if (!search) {
    return {};
  }

  const searchExpression = new RegExp(
    escapeRegularExpression(search),
    "i"
  );

  return {
    $or: [
      { name: searchExpression },
      { emiratesIdNumber: searchExpression },
      { emailAddress: searchExpression },
      { mobileNumber: searchExpression },
      { whatsappNumber: searchExpression },
    ],
  };
};

export const createClient = async (req, res, next) => {
  try {
    const client = await Client.create(req.body);

    logger.info("Client created.", {
      clientId: client.clientId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/clients/${client.clientId}`);
    res.set("ETag", `"${client.version}"`);
    return res.status(201).json({
      data: client,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client creation failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

export const getClient = async (req, res, next) => {
  try {
    const client = await Client.findOne({ clientId: req.params.clientId })
      .select(CLIENT_SUMMARY_FIELDS)
      .lean()
      .exec();

    if (!client) {
      throw new ClientNotFoundError();
    }

    return res.status(200).json({
      data: toClientSummary(client),
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      clientId: req.params.clientId,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

export const listClients = async (req, res, next) => {
  try {
    const { page, limit, search } = req.validatedQuery;
    const filter = buildClientSearchFilter(search);
    const skip = (page - 1) * limit;

    const [clients, total] = await Promise.all([
      Client.find(filter)
        .select(CLIENT_SUMMARY_FIELDS)
        .sort({ createdAt: -1, clientId: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      Client.countDocuments(filter).exec(),
    ]);

    return res.status(200).json({
      data: clients.map(toClientSummary),
      page: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client list lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
