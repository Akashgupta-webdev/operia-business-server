export class ClientCompanyUpdateValidationError extends Error {
  // Converts invalid Client Company update parameters and fields into the shared 422 contract.
  // Structured details allow frontend forms to display every Joi issue beside its field.
  constructor(details) {
    super("The client company information update request is invalid.");
    this.name = "ClientCompanyUpdateValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export class ClientCompanyNotFoundError extends Error {
  // Represents a known Client that has no Company record associated with its MongoDB id.
  // The stable error code lets callers distinguish a missing Company from a missing Client.
  constructor() {
    super("The requested Client Company was not found.");
    this.name = "ClientCompanyNotFoundError";
    this.status = 404;
    this.code = "CLIENT_COMPANY_NOT_FOUND";
  }
}

export class ClientCompanyQueryValidationError extends Error {
  // Converts invalid Client Company list filters into the shared field-addressable 422 contract.
  // Keeping list validation distinct prevents update-specific messages on this read endpoint.
  constructor(details) {
    super("The client company list query is invalid.");
    this.name = "ClientCompanyQueryValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
