import Joi from "joi";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import { ClientDocumentValidationError } from "../errors/clientDocument.error.js";
import { CLIENT_DOCUMENT_TYPES } from "../models/clientDocuments.model.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

export const createClientDocumentBodySchema = Joi.object({
  documentTitle: Joi.string().trim().min(1).max(200),
  documentType: Joi.string()
    .valid(...CLIENT_DOCUMENT_TYPES)
    .default("Other"),
  issueDate: Joi.string()
    .trim()
    .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" }),
  expiryDate: Joi.string()
    .trim()
    .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" }),
})
  .required()
  .unknown(false);

// Validates the owning Client id, optional metadata, and required multipart file together.
// Normalized values are stored separately so raw multipart fields never reach persistence.
export const validateAddClientDocument = (req, _res, next) => {
  const paramsResult = clientMongoIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const bodyResult = createClientDocumentBodySchema.validate(req.body ?? {}, {
    abortEarly: false,
    stripUnknown: false,
  });
  const details = [
    ...(paramsResult.error?.details ?? []),
    ...(bodyResult.error?.details ?? []),
  ].map((detail) => ({
    field: detail.path.join(".") || "body",
    issue: detail.message,
  }));

  if (!req.file) {
    details.push({
      field: "documents",
      issue: "documents must contain exactly one file.",
    });
  }

  if (details.length > 0) {
    return next(new ClientDocumentValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedBody = bodyResult.value;
  return next();
};

// Validates the Client Document MongoDB id before any database or Cloudinary operation.
// The normalized id is stored separately from Express's untrusted path parameters.
export const validateDeleteClientDocument = (req, _res, next) => {
  const { error, value } = clientMongoIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "id",
      issue: detail.message,
    }));
    return next(new ClientDocumentValidationError(details));
  }

  req.validatedParams = value;
  return next();
};
