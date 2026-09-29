import Joi from "joi";
import { ClientDocumentValidationError } from "../errors/clientDocument.error.js";

export const getClientDocumentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  search: Joi.string().trim().min(1).max(100),
}).required().unknown(false);

// Validates and normalizes document list pagination and literal search text.
// Stores trusted input separately and forwards field-specific validation failures.
export const validateGetClientDocuments = (req, _res, next) => {
  const { error, value } = getClientDocumentsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });
  if (error) {
    return next(new ClientDocumentValidationError(error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }))));
  }
  req.validatedQuery = value;
  return next();
};
