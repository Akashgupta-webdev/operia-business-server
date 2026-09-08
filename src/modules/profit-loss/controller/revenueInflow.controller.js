import logger from "../../../logger/index.js";
import { getRevenueInflow as getRevenueInflowService } from "../service/revenueInflow.service.js";

// Returns a validated page of Revenue Inflow records in the collection envelope.
// Lookup failures are safely logged without client or financial values before delegation.
export const getRevenueInflow = async (req, res, next) => {
  try {
    const result = await getRevenueInflowService(req.validatedQuery);

    return res.status(200).json({
      data: result.revenueInflows,
      page: result.page,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Revenue Inflow lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Revenue Inflow lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
