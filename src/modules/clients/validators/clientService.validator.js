import Joi from "joi";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import { ClientServiceValidationError } from "../errors/clientService.error.js";
import {
  CLIENT_SERVICE_CATEGORIES,
  CLIENT_SERVICE_PACKAGES,
  CLIENT_SERVICE_PAYMENT_STATUSES,
  CLIENT_SERVICE_STATUSES,
} from "../models/clientService.model.js";
import { createClientServiceSchema } from "./clientBody.validator.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

const nullableFormattedDate = Joi.string()
  .trim()
  .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" })
  .allow(null);
const nullableDecimalAmount = Joi.string()
  .trim()
  .pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, { name: "decimal amount" })
  .allow(null);
const nullableNotes = Joi.array()
  .items(Joi.string().trim().min(1).max(1000))
  .max(100)
  .allow(null);

export { createClientServiceSchema };

export const updateClientServiceSchema = Joi.object({
  category: Joi.string()
    .valid(...CLIENT_SERVICE_CATEGORIES)
    .allow(null),
  package: Joi.string()
    .valid(...CLIENT_SERVICE_PACKAGES)
    .allow(null),
  status: Joi.string()
    .valid(...CLIENT_SERVICE_STATUSES)
    .allow(null),
  packagePrice: nullableDecimalAmount,
  paymentStatus: Joi.string()
    .valid(...CLIENT_SERVICE_PAYMENT_STATUSES)
    .allow(null),
  targetCompletionDate: nullableFormattedDate,
  notes: nullableNotes,
})
  .min(1)
  .required()
  .unknown(false);

// Maps Joi failures into the field-addressable error shape used by Client APIs.
// Keeping this conversion local gives all Service operations one validation contract.
const createValidationError = (validationDetails) =>
  new ClientServiceValidationError(
    validationDetails.map((detail) => ({
      field: detail.path.join(".") || "request",
      issue: detail.message,
    }))
  );

// Creates middleware that validates one MongoDB path id and the supplied Service body.
// Normalized data is stored separately so unknown fields cannot reach persistence.
const createClientServiceValidator = (bodySchema) => (req, _res, next) => {
  const paramsResult = clientMongoIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const bodyResult = bodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });
  const validationDetails = [
    ...(paramsResult.error?.details ?? []),
    ...(bodyResult.error?.details ?? []),
  ];

  if (validationDetails.length > 0) {
    return next(createValidationError(validationDetails));
  }

  req.validatedParams = paramsResult.value;
  req.validatedBody = bodyResult.value;
  return next();
};

export const validateCreateClientService = createClientServiceValidator(
  createClientServiceSchema
);
export const validateUpdateClientService = createClientServiceValidator(
  updateClientServiceSchema
);

// Validates the Service MongoDB identifier used by the dedicated delete endpoint.
// The validated path is isolated from Express input before controller execution.
export const validateDeleteClientService = (req, _res, next) => {
  const { error, value } = clientMongoIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    return next(createValidationError(error.details));
  }

  req.validatedParams = value;
  return next();
};
