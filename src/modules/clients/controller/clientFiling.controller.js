import logger from "../../../logger/index.js";
import {
  getClientVATFilings as getVATFilings,
  getClientTAXFilings as getTAXFilings,
} from "../services/clientFilingQuery.service.js";

// Creates a filing list handler with a route-fixed VAT or TAX service.
// Logs failures and delegates safe error responses to the shared middleware.
function createClientFilingListHandler(listFilings) {
  return async function getClientFilingList(req, res, next) {
    try {
      const result = await listFilings(req.validatedParams.id, req.validatedQuery);
      return res.status(200).json({
        data: result.filings,
        page: result.page,
        meta: { correlationId: req.correlationId },
      });
    } catch (error) {
      console.error("Client filing list failed.", { errorName: error.name, errorCode: error.code });
      logger.error("Client filing list failed.", { errorName: error.name, correlationId: req.correlationId });
      return next(error);
    }
  };
}

export const getClientVATFilings = createClientFilingListHandler(getVATFilings);
export const getClientTAXFilings = createClientFilingListHandler(getTAXFilings);
