import { getClientCompaniesQuerySchema } from "./clientCompanyQuery.validator.js";
import { ClientRenewalQueryValidationError } from "../errors/clientRenewal.error.js";

export const getClientRenewalsQuerySchema = getClientCompaniesQuerySchema.fork(
  "search", (schema) => schema.forbidden()
);

// Validates renewal pagination using the existing Client list limits and defaults.
// Only normalized query values reach the controller; unsupported filters are rejected.
export const validateGetClientRenewals = (req, _res, next) => {
  const { error, value } = getClientRenewalsQuerySchema.validate(req.query, {
    abortEarly: false, stripUnknown: false,
  });
  if (error) {
    return next(new ClientRenewalQueryValidationError(error.details.map((detail) => ({
      field: detail.path.join(".") || "query", issue: detail.message,
    }))));
  }
  req.validatedQuery = value;
  return next();
};
