export class ClientRelatedRecordValidationError extends Error {
  // Converts invalid related-record update or delete input into the shared 422 contract.
  // Structured details allow the frontend to associate each Joi failure with its field.
  constructor(details) {
    super("The client related record request is invalid.");
    this.name = "ClientRelatedRecordValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export class ClientRelatedRecordNotFoundError extends Error {
  // Represents a valid related-record identifier with no document in the selected collection.
  // The action-specific code lets callers distinguish the missing resource type safely.
  constructor(actionOn) {
    super(`The requested Client ${actionOn} was not found.`);
    this.name = "ClientRelatedRecordNotFoundError";
    this.status = 404;
    this.code = `CLIENT_${actionOn.toUpperCase()}_NOT_FOUND`;
  }
}
