export class RevenueInflowQueryValidationError extends Error {
  // Converts invalid Revenue Inflow pagination values into the shared 422 contract.
  // Structured details let API consumers associate each issue with its query field.
  constructor(details) {
    super("The revenue inflow query is invalid.");
    this.name = "RevenueInflowQueryValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
