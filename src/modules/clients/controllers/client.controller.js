import logger from "../../../logger/index.js";
import {
  deleteUploadedDocuments,
  uploadDocuments,
} from "../../common/services/document-upload.service.js";
import {
  ClientNotFoundError,
  ClientValidationError,
} from "../errors/client.error.js";
import Client from "../models/client.model.js";
import {
  createClientWithService,
  editServiceByClientMongoId,
  getClientService,
  listServicesByClientMongoId,
} from "../services/client-service.service.js";

const CLIENT_SUMMARY_FIELDS =
  "_id clientType clientId name emiratesIdNumber emailAddress mobileNumber whatsappNumber nationality passportNumber address preferredCommunicationMethod clientStatus";

const toClientSummary = (client) => ({
  _id: client._id,
  clientId: client.clientId,
  name: client.name,
  emiratesIdNumber: client.emiratesIdNumber ?? null,
  emailAddress: client.emailAddress ?? null,
  mobileNumber: client.mobileNumber ?? null,
  whatsappNumber: client.whatsappNumber ?? null,
  clientType: client.clientType ?? null,
  nationality: client.nationality ?? null,
  passportNumber: client.passportNumber ?? null,
  address: client.address ?? null,
  preferredCommunicationMethod: client.preferredCommunicationMethod ?? null,
  clientStatus: client.clientStatus,
});

const toUpdatedClient = (client) => {
  const { _id, clientId, ...editableFields } = toClientSummary(client);
  return editableFields;
};

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

export const createCompleteClientService = async (req, res, next) => {
  let uploads = [];

  try {
    uploads = await uploadDocuments(req.files ?? [], req.correlationId);
    const result = await createClientWithService(req.validatedPayload, uploads);

    logger.info("Client Service package created.", {
      clientId: result.client.clientId,
      companyId: result.company?.companyId,
      serviceId: result.service._id.toString(),
      documentCount: result.documents.length,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/clients/${result.client.clientId}`);
    res.set("ETag", `"${result.client.version}"`);
    return res.status(201).json({
      data: result,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    await deleteUploadedDocuments(uploads);
    logger.error("Client Service package creation failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

export const getCompleteClientService = async (req, res, next) => {
  try {
    const { clientId, serviceId } = req.validatedParams;
    const result = await getClientService(clientId, serviceId);

    return res.status(200).json({
      data: result,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client Service package lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      clientId: req.params.clientId,
      serviceId: req.params.serviceId,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

export const listClientServices = async (req, res, next) => {
  try {
    const { clientMongoId } = req.validatedParams;
    const result = await listServicesByClientMongoId(
      clientMongoId,
      req.validatedQuery
    );

    return res.status(200).json({
      data: result.services,
      page: result.page,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client Service list lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      clientMongoId: req.params.clientMongoId,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

export const editClientService = async (req, res, next) => {
  try {
    const { clientMongoId, serviceId } = req.validatedParams;
    const service = await editServiceByClientMongoId(
      clientMongoId,
      serviceId,
      req.validatedBody
    );

    logger.info("Client Service updated.", {
      clientMongoId,
      serviceId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.set("ETag", `"${service.version}"`);
    return res.status(200).json({
      data: service,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client Service update failed.", {
      errorName: error.name,
      errorCode: error.code,
      clientMongoId: req.params.clientMongoId,
      serviceId: req.params.serviceId,
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

export const updateClient = async (req, res, next) => {
  try {
    const { clientId } = req.validatedParams;
    const client = await Client.findOne({ clientId }).exec();

    if (!client) {
      throw new ClientNotFoundError();
    }

    client.set(req.validatedBody);
    await client.save();

    logger.info("Client updated.", {
      clientId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.set("ETag", `"${client.version}"`);
    return res.status(200).json({
      data: toUpdatedClient(client),
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError = error.name === "ValidationError"
      ? new ClientValidationError(
          Object.entries(error.errors).map(([field, validationError]) => ({
            field,
            issue: validationError.message,
          }))
        )
      : error;

    logger.error("Client update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      clientId: req.params.clientId,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
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
