export class ExpenseValidationError extends Error {
  // Converts invalid Expense request fields into the shared field-addressable 422 contract.
  // Structured details allow clients to render every Joi issue beside its form field.
  constructor(details) {
    super("The expense creation request is invalid.");
    this.name = "ExpenseValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}
