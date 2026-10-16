export class ClientFilingError extends Error {
  // Represents safe standalone VAT/TAX filing validation and persistence failures.
  // Stable codes and field details follow the shared API error contract.
  constructor(code, message, status = 422, details = []) {
    super(message);
    this.name = "ClientFilingError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
