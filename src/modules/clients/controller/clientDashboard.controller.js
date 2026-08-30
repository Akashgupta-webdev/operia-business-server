import logger from "../../../logger/index.js";
import { getClientDashboardKPI as getClientDashboardKPIService } from "../services/clientDashboard.service.js";

// Returns the validated Client dashboard KPI snapshot in the standard response envelope.
// Aggregation errors are logged without business data and delegated to shared error handling.
export const getClientDashboardKPI = async (req, res, next) => {
  try {
    const dashboardKPI = await getClientDashboardKPIService(
      req.validatedQuery
    );

    return res.status(200).json({
      data: dashboardKPI,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Client dashboard KPI lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Client dashboard KPI lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
