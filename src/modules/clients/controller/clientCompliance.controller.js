import logger from "../../../logger/index.js";
import { getClientInformationForCompliance as getComplianceInformation } from "../services/clientComplianceInformation.service.js";
import { getClients } from "../services/clientQuery.service.js";
import { getAddedComplianceClients } from "../services/clientComplianceQuery.service.js";
import { updateClientInformation } from "../services/clientUpdate.service.js";

// Creates a list handler with a fixed compliance membership filter.
// Database access and pagination remain in the shared Client query service.
const createComplianceListHandler = (complianceService) => {
  return async function getClientsByComplianceMembership(req, res, next) {
    try {
      const result = complianceService
        ? await getAddedComplianceClients(req.validatedQuery)
        : await getClients(req.validatedQuery, { complianceService });
      return res.status(200).json({
        data: result.clients,
        page: result.page,
        ...(result.metrics ? { metrics: result.metrics } : {}),
        meta: { correlationId: req.correlationId },
      });
    } catch (error) {
      console.error("Client compliance list failed.", { errorName: error.name, errorCode: error.code });
      logger.error("Client compliance list failed.", { errorName: error.name, correlationId: req.correlationId });
      return next(error);
    }
  };
};

// Creates a membership command whose target boolean is fixed by the route.
// Reuses validated, versioned Client persistence and returns only membership confirmation.
const createComplianceUpdateHandler = (complianceService) => {
  return async function updateClientComplianceMembership(req, res, next) {
    try {
      const client = await updateClientInformation(req.validatedBody._id, { complianceService });
      res.set("ETag", `"${client.version}"`);
      return res.status(200).json({
        data: { _id: client._id.toString(), complianceService: client.complianceService },
        meta: { correlationId: req.correlationId },
      });
    } catch (error) {
      console.error("Client compliance update failed.", { errorName: error.name, errorCode: error.code });
      logger.error("Client compliance update failed.", { errorName: error.name, correlationId: req.correlationId });
      return next(error);
    }
  };
};

export const getClientForAddingInComplianceService = createComplianceListHandler(false);
export const getClientAddedInComplianceService = createComplianceListHandler(true);
export const AddClientInComplianceService = createComplianceUpdateHandler(true);
export const RemoveClientFromComplianceService = createComplianceUpdateHandler(false);

// Returns one client's compliance details and filing/deadline metrics.
// The service owns database access; failures use the shared response error handler.
export async function getClientInformationForCompliance(req, res, next) {
  try {
    const result = await getComplianceInformation(req.validatedParams.id);
    return res.status(200).json({
      data: result.information,
      metrics: result.metrics,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client compliance information lookup failed.", { errorName: error.name, errorCode: error.code });
    logger.error("Client compliance information lookup failed.", { errorName: error.name, correlationId: req.correlationId });
    return next(error);
  }
}
