export class ClientUpdateValidationError extends Error {
  // Converts invalid Client update parameters and fields into the shared 422 response contract.
  // Structured details let frontend forms associate every Joi failure with its input field.
  constructor(details) {
    super("The client information update request is invalid.");
    this.name = "ClientUpdateValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
