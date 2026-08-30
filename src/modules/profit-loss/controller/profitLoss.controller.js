import logger from "../../../logger/index.js";
import { getProfitLoss as getProfitLossService } from "../service/profitLoss.service.js";

// Returns the validated monthly Profit and Loss report in the standard response envelope.
// Aggregation failures are logged without financial values and delegated to shared handling.
export const getProfitLoss = async (req, res, next) => {
  try {
    const profitLoss = await getProfitLossService(req.validatedQuery);

    return res.status(200).json({
      data: profitLoss,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    console.error("Profit and Loss lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
    });
    logger.error("Profit and Loss lookup failed.", {
      errorName: error.name,
      errorCode: error.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(error);
  }
};
