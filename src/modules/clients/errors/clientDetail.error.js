export class ClientDetailValidationError extends Error {
  // Converts invalid Client detail path parameters into the shared 422 response contract.
  // Structured details allow callers to associate the failure with the id field.
  constructor(details) {
    super("The client detail parameters are invalid.");
    this.name = "ClientDetailValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export class ClientNotFoundError extends Error {
  // Represents a valid Client identifier that has no corresponding database record.
  // The stable code lets frontend detail views distinguish absence from lookup failures.
  constructor() {
    super("The requested Client was not found.");
    this.name = "ClientNotFoundError";
    this.status = 404;
    this.code = "CLIENT_NOT_FOUND";
  }
}
