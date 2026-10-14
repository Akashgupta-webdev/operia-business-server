import Joi from "joi";
import { getClientCompaniesQuerySchema } from "./clientCompanyQuery.validator.js";
import { ClientDetailValidationError } from "../errors/clientDetail.error.js";

export const clientFilingQuerySchema = Joi.object({
  page: getClientCompaniesQuerySchema.extract("page"),
  limit: getClientCompaniesQuerySchema.extract("limit"),
}).required().unknown(false);

// Validates filing pagination using the existing client page and limit rules.
// Rejects unsupported query fields before any database access.
export function validateClientFilingQuery(req, _res, next) {
  const { error, value } = clientFilingQuerySchema.validate(req.query, { abortEarly: false });
  if (error) {
    return next(new ClientDetailValidationError(error.details.map((detail) => ({
      field: detail.path.join(".") || "query", issue: detail.message,
    }))));
  }
  req.validatedQuery = value;
  return next();
}
