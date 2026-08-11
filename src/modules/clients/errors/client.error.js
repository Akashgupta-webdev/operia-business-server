export class ClientNotFoundError extends Error {
  constructor() {
    super("Client was not found.");
    this.name = "ClientNotFoundError";
    this.status = 404;
    this.code = "CLIENT_NOT_FOUND";
  }
}
