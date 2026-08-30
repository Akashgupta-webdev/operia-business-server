export class ClientDocumentValidationError extends Error {
  // Converts invalid Client Document path, metadata, and file input into the shared 422 contract.
  // Structured details allow multipart forms to associate each failure with its input field.
  constructor(details) {
    super("The client document request is invalid.");
    this.name = "ClientDocumentValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export class ClientDocumentNotFoundError extends Error {
  // Represents a valid Document identifier with no matching Client Document record.
  // The stable code lets callers distinguish absence from upload-provider failures.
  constructor() {
    super("The requested Client Document was not found.");
    this.name = "ClientDocumentNotFoundError";
    this.status = 404;
    this.code = "CLIENT_DOCUMENT_NOT_FOUND";
  }
}
