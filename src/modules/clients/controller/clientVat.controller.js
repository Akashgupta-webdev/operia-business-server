import logger from "../../../logger/index.js";
import { normalizeVatError } from "../errors/clientVat.error.js";
import { executeVatAction, getVatService, listVatServices } from "../services/clientVat.service.js";

// Creates a named-action handler while keeping business decisions in services.
// Errors are logged without tax data and passed to the shared response middleware.
export const handleVatRequest = (action) => async function handleClientVatRequest(req, res, next) {
  try {
    if (action === "list") {
      const result = await listVatServices(req.validatedBody);
      return res.json({ ...result, meta: { correlationId: req.correlationId } });
    }
    const result = action === "detail"
      ? await getVatService(req.validatedParams.id)
      : await executeVatAction(req.validatedParams.id, action, req.validatedBody, req.user.id);
    res.set("ETag", `"${result.service.version}"`);
    return res.status(action === "create-next-period" ? 201 : 200).json({ data: result, meta: { correlationId: req.correlationId } });
  } catch (error) {
    const normalized = normalizeVatError(error);
    const context = { action, errorName: normalized.name, errorCode: normalized.code, serviceId: req.validatedParams?.id, actorId: req.user?.id, correlationId: req.correlationId };
    console.error("VAT request failed.", context);
    logger.error("VAT request failed.", context);
    return next(normalized);
  }
};
