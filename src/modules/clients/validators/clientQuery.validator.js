import Joi from "joi";

import { ClientQueryValidationError } from "../errors/clientCreation.error.js";
import { CLIENT_STATUSES, CLIENT_TYPES } from "../models/client.model.js";

export const CLIENT_LIST_SORTS = Object.freeze([
  "Newest First",
  "Oldest First",
  "Name(A-Z)",
  "Name(Z-A)",
]);

export const getClientsQuerySchema = Joi.object({
  search: Joi.string().trim().min(1).max(100),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  status: Joi.string().valid(...CLIENT_STATUSES),
  clientType: Joi.string().valid(...CLIENT_TYPES),
  sort: Joi.string()
    .valid(...CLIENT_LIST_SORTS)
    .default("Newest First"),
})
  .required()
  .unknown(false);

// Validates list filters, applies pagination and sorting defaults, and rejects unknown query keys.
// The normalized query is stored separately so the controller never consumes unvalidated input.
export const validateGetClients = (req, _res, next) => {
  const { error, value } = getClientsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new ClientQueryValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};
