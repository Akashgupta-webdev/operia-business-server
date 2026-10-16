import logger from "../../../logger/index.js";
import { saveClientFiling, deleteClientFiling } from "../services/clientFilingWrite.service.js";
import { ClientFilingError } from "../errors/clientFiling.error.js";

// Builds a named standalone filing handler with a fixed type and operation from the route.
// Shared response and error handling keep the VAT and TAX contracts identical.
export function createFilingWriteHandler(type, action) {
  // Dispatches validated filing input and returns the committed resource with its version.
  // Logs safe failure metadata and forwards structured errors to the shared middleware.
  return async function handleFilingWrite(req, res, next) {
    try {
      const id = action === "create" ? req.validatedParams.companyId : req.validatedParams.id;
      const data = action === "delete"
        ? await deleteClientFiling(type, id)
        : await saveClientFiling(type, action, id, req.validatedBody);
      if (action !== "delete") res.set("ETag", `"${data.version}"`);
      return res.status(action === "create" ? 201 : 200).json({ data, meta: { correlationId: req.correlationId } });
    } catch (error) {
      let responseError = error;
      if (error.name === "ValidationError") {
        responseError = new ClientFilingError("VALIDATION_FAILED", "The filing request is invalid.", 422,
          Object.entries(error.errors).map(([field, issue]) => ({ field, issue: issue.message })));
      } else if (error.name === "VersionError") {
        responseError = new ClientFilingError("VERSION_CONFLICT", "The filing or company changed. Reload and retry.", 409);
      }
      const details = { type, action, errorName: responseError.name, errorCode: responseError.code, correlationId: req.correlationId };
      console.error("Client filing write failed.", details);
      logger.error("Client filing write failed.", details);
      return next(responseError);
    }
  };
}
