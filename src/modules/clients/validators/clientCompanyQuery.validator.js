import Joi from "joi";

import { ClientCompanyQueryValidationError } from "../errors/clientCompanyUpdate.error.js";

export const getClientCompaniesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().trim().min(1).max(100),
})
  .required()
  .unknown(false);

// Validates Client Company search and pagination values and rejects unknown query fields.
// Normalized defaults are stored separately so the controller consumes only trusted input.
export const validateGetClientCompanies = (req, _res, next) => {
  const { error, value } = getClientCompaniesQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new ClientCompanyQueryValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};
