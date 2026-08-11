export class AuthenticationError extends Error {
  constructor(message = "Authentication is required.", code = "AUTHENTICATION_REQUIRED") {
    super(message);
    this.name = "AuthenticationError";
    this.status = 401;
    this.code = code;
  }
}

export class ValidationError extends Error {
  constructor(details) {
    super("The authentication request is invalid.");
    this.name = "ValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
