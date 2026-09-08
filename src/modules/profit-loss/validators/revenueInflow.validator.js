import Joi from "joi";

import { RevenueInflowQueryValidationError } from "../errors/revenueInflow.error.js";

export const getRevenueInflowQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
})
  .required()
  .unknown(false);

// Validates Revenue Inflow pagination and rejects unknown query parameters.
// Normalized defaults are stored separately so services receive only trusted values.
export const validateGetRevenueInflow = (req, _res, next) => {
  const { error, value } = getRevenueInflowQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new RevenueInflowQueryValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};
