import logger from "../../../logger/index.js";
import { ClientServiceValidationError } from "../errors/clientService.error.js";
import {
  createClientService as createClientServiceRecord,
  deleteClientService as deleteClientServiceRecord,
  updateClientService as updateClientServiceRecord,
} from "../services/clientService.service.js";

// Converts Mongoose validation failures into the shared field-addressable 422 response.
// Joi handles request shape first, while this protects against model-level rule changes.
const normalizeClientServiceError = (error) =>
  error.name === "ValidationError"
    ? new ClientServiceValidationError(
        Object.entries(error.errors).map(([field, validationError]) => ({
          field,
          issue: validationError.message,
        }))
      )
    : error;

// Creates one validated Service for the Client selected by its MongoDB identifier.
// Persistence errors are logged safely and delegated to the standard error middleware.
export const createClientService = async (req, res, next) => {
  try {
    const service = await createClientServiceRecord(
      req.validatedParams.id,
      req.validatedBody
    );
    const serviceId = service._id.toString();

    logger.info("Client Service created.", {
      clientId: req.validatedParams.id,
      serviceId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/client/service/${serviceId}`);
    res.set("ETag", `"${service.version}"`);
    return res.status(201).json({
      data: service,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError = normalizeClientServiceError(error);
    console.error("Client Service creation failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
    });
    logger.error("Client Service creation failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      clientId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
  }
};

// Updates one validated Service and returns its incremented optimistic version.
// Persistence errors are logged safely and delegated to the standard error middleware.
export const updateClientService = async (req, res, next) => {
  try {
    const service = await updateClientServiceRecord(
      req.validatedParams.id,
      req.validatedBody
    );

    logger.info("Client Service updated.", {
      serviceId: req.validatedParams.id,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.set("ETag", `"${service.version}"`);
    return res.status(200).json({
      data: service,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError = normalizeClientServiceError(error);
    console.error("Client Service update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
    });
    logger.error("Client Service update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      serviceId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
  }
};

// Deletes the Service selected by its validated MongoDB identifier.
// The response confirms the deleted id without returning stale Service information.
export const deleteClientService = async (req, res, next) => {
  try {
    const serviceId = req.validatedParams.id;
    await deleteClientServiceRecord(serviceId);

    logger.info("Client Service deleted.", {
      serviceId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    return res.status(200).json({
      data: { id: serviceId },
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client Service deletion failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Client Service deletion failed.", {
      errorName: error.name,
      errorCode: error.code,
      serviceId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
