export class ClientRenewalQueryValidationError extends Error {
  // Maps invalid renewal pagination to the existing field-addressable validation response.
  // The stable code allows clients to handle this query like other Client list queries.
  constructor(details) {
    super("The client renewals query is invalid.");
    this.name = "ClientRenewalQueryValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
