export class ClientDashboardKPIValidationError extends Error {
  // Converts invalid dashboard filters into the shared field-addressable 422 contract.
  // A dedicated error keeps dashboard failures distinct from paginated Client list errors.
  constructor(details) {
    super("The client dashboard KPI query is invalid.");
    this.name = "ClientDashboardKPIValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
