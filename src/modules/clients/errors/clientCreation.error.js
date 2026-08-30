export class ClientCreationValidationError extends Error {
  // Converts Joi and cross-field validation failures into the shared 422 API contract.
  // Details remain structured so frontend forms can associate messages with fields.
  constructor(details, message = "The client creation request is invalid.") {
    super(message);
    this.name = "ClientCreationValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export class ClientPayloadSyntaxError extends Error {
  // Represents malformed JSON in the multipart payload field as a syntax-level request error.
  // A stable code and field detail allow the frontend to distinguish parsing from validation.
  constructor() {
    super("The payload field must contain valid JSON.");
    this.name = "ClientPayloadSyntaxError";
    this.status = 400;
    this.code = "MALFORMED_REQUEST";
    this.details = [
      { field: "payload", issue: "payload must contain valid JSON." },
    ];
  }
}

export class ClientQueryValidationError extends Error {
  // Converts invalid list filters into the shared field-addressable 422 response contract.
  // Keeping query errors distinct prevents creation-specific messages on read endpoints.
  constructor(details) {
    super("The client list query is invalid.");
    this.name = "ClientQueryValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
