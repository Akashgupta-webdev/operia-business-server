export class ClientVatError extends Error {
  // Carries a safe VAT business failure through the existing error middleware.
  // Stable codes distinguish validation, concurrency and lifecycle conflicts.
  constructor(code, message, status = 422) {
    super(message);
    this.name = "ClientVatError";
    this.code = code;
    this.status = status;
  }
}

// Converts persistence races into stable API conflicts without exposing database data.
// Other errors retain their original handling in the application's error middleware.
export const normalizeVatError = (error) => {
  if (error.code === 11000) {
    if (error.keyPattern?.service) return new ClientVatError("VERSION_CONFLICT", "The reminder changed. Reload before retrying.", 409);
    if (!error.keyPattern || error.keyPattern["details.vat.trn"] || error.keyPattern.previousService) return new ClientVatError("VAT_PERIOD_EXISTS", "A filing already exists for this registration/period or predecessor.", 409);
  }
  if (error.name === "VersionError") return new ClientVatError("VERSION_CONFLICT", "The service changed. Reload before retrying.", 409);
  return error;
};
