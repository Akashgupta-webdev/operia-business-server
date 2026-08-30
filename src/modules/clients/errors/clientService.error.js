export class ClientServiceValidationError extends Error {
  // Converts invalid Client Service path parameters and bodies to the shared 422 contract.
  // Structured details let callers associate each Joi failure with its input field.
  constructor(details) {
    super("The client service request is invalid.");
    this.name = "ClientServiceValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export class ClientServiceNotFoundError extends Error {
  // Represents a valid Service identifier with no matching Client Service document.
  // The stable error code lets callers distinguish absence from persistence failures.
  constructor() {
    super("The requested Client Service was not found.");
    this.name = "ClientServiceNotFoundError";
    this.status = 404;
    this.code = "CLIENT_SERVICE_NOT_FOUND";
  }
}
