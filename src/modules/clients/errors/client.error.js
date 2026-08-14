export class ClientNotFoundError extends Error {
  constructor() {
    super("Client was not found.");
    this.name = "ClientNotFoundError";
    this.status = 404;
    this.code = "CLIENT_NOT_FOUND";
  }
}

export class ClientServiceNotFoundError extends Error {
  constructor() {
    super("Client Service was not found.");
    this.name = "ClientServiceNotFoundError";
    this.status = 404;
    this.code = "CLIENT_SERVICE_NOT_FOUND";
  }
}

export class ClientValidationError extends Error {
  constructor(details) {
    super("The client request is invalid.");
    this.name = "ClientValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
