import logger from "../../../logger/index.js";
import { ClientRelatedRecordValidationError } from "../errors/clientRelatedRecord.error.js";
import {
  createClientDriver as createClientDriverService,
  createClientMember as createClientMemberService,
  createClientVehicle as createClientVehicleService,
  deleteClientRelatedRecord as deleteClientRelatedRecordService,
  updateClientDriver as updateClientDriverService,
  updateClientMember as updateClientMemberService,
  updateClientVehicle as updateClientVehicleService,
} from "../services/clientRelatedRecord.service.js";

// Converts Mongoose validation failures without exposing persistence internals to callers.
// Joi handles request validation first, while this protects against model-level rule changes.
const normalizeRelatedRecordError = (error) =>
  error.name === "ValidationError"
    ? new ClientRelatedRecordValidationError(
        Object.entries(error.errors).map(([field, validationError]) => ({
          field,
          issue: validationError.message,
        }))
      )
    : error;

// Creates a controller that persists one validated record for an existing Client.
// Successful creates return the standard envelope with resource and version headers.
const createRelatedRecordController = (actionOn, createService) =>
  async (req, res, next) => {
    try {
      const record = await createService(
        req.validatedParams.id,
        req.validatedBody
      );
      const recordId = record._id.toString();

      logger.info(`Client ${actionOn} created.`, {
        clientId: req.validatedParams.id,
        recordId,
        actorId: req.user.id,
        correlationId: req.correlationId,
      });

      res.location(`/api/v1/client/${actionOn}/${recordId}`);
      res.set("ETag", `"${record.version}"`);
      return res.status(201).json({
        data: record,
        meta: { correlationId: req.correlationId },
      });
    } catch (error) {
      const responseError = normalizeRelatedRecordError(error);
      console.error(`Client ${actionOn} creation failed.`, {
        errorName: responseError.name,
        errorCode: responseError.code,
      });
      logger.error(`Client ${actionOn} creation failed.`, {
        errorName: responseError.name,
        errorCode: responseError.code,
        clientId: req.validatedParams?.id,
        actorId: req.user?.id,
        correlationId: req.correlationId,
      });
      return next(responseError);
    }
  };

export const createClientMember = createRelatedRecordController(
  "member",
  createClientMemberService
);
export const createClientVehicle = createRelatedRecordController(
  "vehicle",
  createClientVehicleService
);
export const createClientDriver = createRelatedRecordController(
  "driver",
  createClientDriverService
);

// Creates an update controller for one related-record type and its dedicated service.
// Every generated controller logs safe identifiers and returns the standard write envelope.
const createUpdateController = (actionOn, updateService) =>
  async (req, res, next) => {
    try {
      const record = await updateService(
        req.validatedParams.id,
        req.validatedBody
      );

      logger.info(`Client ${actionOn} updated.`, {
        recordId: req.validatedParams.id,
        actorId: req.user.id,
        correlationId: req.correlationId,
      });

      res.set("ETag", `"${record.version}"`);
      return res.status(200).json({
        data: record,
        meta: { correlationId: req.correlationId },
      });
    } catch (error) {
      const responseError = normalizeRelatedRecordError(error);
      console.error(`Client ${actionOn} update failed.`, {
        errorName: responseError.name,
        errorCode: responseError.code,
      });
      logger.error(`Client ${actionOn} update failed.`, {
        errorName: responseError.name,
        errorCode: responseError.code,
        recordId: req.validatedParams?.id,
        actorId: req.user?.id,
        correlationId: req.correlationId,
      });
      return next(responseError);
    }
  };

export const updateClientMember = createUpdateController(
  "member",
  updateClientMemberService
);
export const updateClientVehicle = createUpdateController(
  "vehicle",
  updateClientVehicleService
);
export const updateClientDriver = createUpdateController(
  "driver",
  updateClientDriverService
);

// Deletes the validated related record selected by the actionOn query value.
// The response identifies what was removed while persistence stays inside the service layer.
export const deleteClientRelatedRecord = async (req, res, next) => {
  try {
    const { _id: recordId, actionOn } = req.validatedQuery;
    await deleteClientRelatedRecordService(recordId, actionOn);

    logger.info(`Client ${actionOn} deleted.`, {
      recordId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    return res.status(200).json({
      data: { id: recordId, actionOn },
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client related record deletion failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Client related record deletion failed.", {
      errorName: error.name,
      errorCode: error.code,
      recordId: req.validatedQuery?._id,
      actionOn: req.validatedQuery?.actionOn,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
