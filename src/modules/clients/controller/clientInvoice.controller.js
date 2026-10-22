import logger from "../../../logger/index.js";
import { serializeInvoiceDetail } from "../utils/clientInvoice.utils.js";
import { ClientInvoiceError } from "../errors/clientInvoice.error.js";
import { createClientInvoice, getClientInvoice, listClientInvoices, updateClientInvoice, deleteClientInvoice } from "../services/clientInvoice.service.js";

// Builds route-specific invoice handlers while keeping persistence in the service.
// Responses follow the standard envelope, version header and safe error contract.
export function createInvoiceHandler(action) {
  // Executes the validated invoice operation and responds only after it completes.
  // Logs safe failure metadata to the terminal and application logger for diagnosis.
  return async function handleClientInvoiceRequest(req, res, next) {
    try {
      const id = req.validatedParams.id;
      const meta = { correlationId: req.correlationId };
      if (action === "list") return res.json({ ...await listClientInvoices(req.validatedQuery), meta });
      const data = action === "create" ? await createClientInvoice(req.validatedBody)
        : action === "update" ? await updateClientInvoice(id, req.validatedBody)
          : action === "delete" ? await deleteClientInvoice(id, req.validatedQuery.expectedVersion)
            : await getClientInvoice(id);
      if (action !== "delete") res.set("ETag", `"${data.version}"`);
      if (action === "create") res.location(`/api/v1/client/invoices/${data._id}`);
      return res.status(action === "create" ? 201 : 200).json({
        data: action === "detail" ? serializeInvoiceDetail(data) : data,
        meta,
      });
    } catch (error) {
      let responseError = error;
      if (["ValidationError", "CastError", "StrictModeError"].includes(error.name)) {
        responseError = new ClientInvoiceError("VALIDATION_FAILED", "The invoice request is invalid.");
      } else if (error.name === "VersionError" || error.code === 11000) {
        responseError = new ClientInvoiceError("VERSION_CONFLICT", "The invoice changed or its number already exists. Retry.", 409);
      }
      const details = { action, errorName: responseError.name, errorCode: responseError.code, correlationId: req.correlationId };
      console.error("Client invoice request failed.", details);
      logger.error("Client invoice request failed.", details);
      return next(responseError);
    }
  };
}
