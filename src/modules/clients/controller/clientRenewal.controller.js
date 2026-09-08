import logger from "../../../logger/index.js";
import { getClientRenewals as getClientRenewalsService } from "../services/clientRenewal.service.js";

// Returns a chronological page of renewal records through the standard collection envelope.
// Failures are logged without personal record content and delegated to the shared error handler.
export const getClientRenewals = async (req, res, next) => {
  try {
    const result = await getClientRenewalsService(req.validatedQuery);
    return res.status(200).json({
      data: result.renewals, page: result.page,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client renewals lookup failed.", { errorName: error.name, errorCode: error.code });
    logger.error("Client renewals lookup failed.", {
      errorName: error.name, errorCode: error.code,
      actorId: req.user?.id, correlationId: req.correlationId,
    });
    return next(error);
  }
};
