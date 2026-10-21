export class ClientInvoiceError extends Error {
  // Carries safe invoice failures to the existing HTTP error middleware.
  // Stable codes distinguish validation, missing records and version conflicts.
  constructor(code, message, status = 422, details = []) {
    super(message);
    this.name = "ClientInvoiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
