import Joi from "joi";

import { ProfitLossQueryValidationError } from "../errors/profitLoss.error.js";

export const getProfitLossQuerySchema = Joi.object({
  month: Joi.number().integer().min(1).max(12).required(),
  year: Joi.number().integer().min(2000).max(9999).required(),
})
  .required()
  .unknown(false);

// Validates the required monthly reporting period and rejects unknown query fields.
// Normalized numeric values are stored separately so raw URL strings never reach services.
export const validateGetProfitLoss = (req, _res, next) => {
  const { error, value } = getProfitLossQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new ProfitLossQueryValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};
