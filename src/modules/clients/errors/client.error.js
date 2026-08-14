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
