import logger from "../../../logger/index.js";
import { createClientAggregate } from "../services/clientCreation.service.js";
import { getClientDetails as getClientDetailsService } from "../services/clientDetail.service.js";
import { getClients as getClientsService } from "../services/clientQuery.service.js";
import { updateClientInformation as updateClientInformationService } from "../services/clientUpdate.service.js";
import { ClientUpdateValidationError } from "../errors/clientUpdate.error.js";

// Creates the complete Client aggregate and returns every record committed by the transaction.
// Errors are logged without request PII and delegated to the standard API error handler.
export const createClient = async (req, res, next) => {
  try {
    const result = await createClientAggregate(
      req.validatedPayload,
      req.files ?? [],
      req.correlationId
    );
    const clientId = result.client._id.toString();

    logger.info("Client aggregate created.", {
      clientId,
      actorId: req.user.id,
      relatedRecordCount:
        result.members.length +
        result.vehicles.length +
        result.drivers.length +
        result.services.length +
        result.documents.length +
        result.payments.length +
        result.reminders.length +
        (result.company ? 1 : 0),
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/client/${clientId}`);
    res.set("ETag", `"${result.client.version}"`);
    return res.status(201).json({
      data: result,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.log("error:", error);
    logger.error("Client aggregate creation failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

// Returns the validated, filtered Client page with Company, Service, and Document summaries.
// Database lookup details remain in the query service and errors use the shared response handler.
export const getClients = async (req, res, next) => {
  try {
    const result = await getClientsService(req.validatedQuery);

    return res.status(200).json({
      data: result.clients,
      page: result.page,
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

// Returns one Client together with every record directly associated through its MongoDB id.
// Errors are logged without Client details and delegated to the standard response handler.
export const getClientDetails = async (req, res, next) => {
  try {
    const result = await getClientDetailsService(req.validatedParams.id);

    return res.status(200).json({
      data: result,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    logger.error("Client detail lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      clientId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};

// Updates one Client using only the MongoDB id and fields normalized by Joi middleware.
// Persistence errors are safely logged and delegated to the standard API error handler.
export const updateClientInformation = async (req, res, next) => {
  try {
    const client = await updateClientInformationService(
      req.validatedParams.id,
      req.validatedBody
    );

    logger.info("Client information updated.", {
      clientId: req.validatedParams.id,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.set("ETag", `"${client.version}"`);
    return res.status(200).json({
      data: client,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError =
      error.name === "ValidationError"
        ? new ClientUpdateValidationError(
            Object.entries(error.errors).map(([field, validationError]) => ({
              field,
              issue: validationError.message,
            }))
          )
        : error;

    console.error("Client information update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
    });
    logger.error("Client information update failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      clientId: req.validatedParams?.id,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
  }
};

const ClientController = {
  createClient,
  getClients,
  getClientDetails,
  updateClientInformation,
};

export default ClientController;
