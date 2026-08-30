export class ProfitLossQueryValidationError extends Error {
  // Converts invalid monthly Profit and Loss filters into the shared 422 response contract.
  // Structured details allow clients to associate validation issues with query fields.
  constructor(details) {
    super("The profit and loss query is invalid.");
    this.name = "ProfitLossQueryValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
