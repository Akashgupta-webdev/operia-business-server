import Joi from "joi";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import { ClientRelatedRecordValidationError } from "../errors/clientRelatedRecord.error.js";
import { CLIENT_MEMBER_TYPES } from "../models/clientMembers.model.js";
import {
  createClientDriverSchema,
  createClientMemberSchema,
  createClientVehicleSchema,
  emiratesSchema,
  healthInsuranceSchema,
  passportSchema,
  visaSchema,
} from "./clientBody.validator.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

export const CLIENT_RELATED_RECORD_ACTIONS = Object.freeze([
  "member",
  "vehicle",
  "driver",
]);

const nullableBoundedString = (maximum) =>
  Joi.string().trim().min(1).max(maximum).allow(null);
const nullableFormattedDate = Joi.string()
  .trim()
  .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" })
  .allow(null);

export const updateClientMemberSchema = Joi.object({
  memberType: Joi.string().valid(...CLIENT_MEMBER_TYPES).allow(null),
  name: nullableBoundedString(200),
  passport: passportSchema.allow(null),
  emirates: emiratesSchema.allow(null),
  visa: visaSchema.allow(null),
  healthInsurance: healthInsuranceSchema.allow(null),
})
  .min(1)
  .required()
  .unknown(false);

export const updateClientVehicleSchema = Joi.object({
  registrationNumer: nullableBoundedString(100),
  tcNumber: nullableBoundedString(100),
  policyNumber: nullableBoundedString(100),
  registrationExpiry: nullableFormattedDate,
  insuranceExpiry: nullableFormattedDate,
})
  .min(1)
  .required()
  .unknown(false);

export const updateClientDriverSchema = Joi.object({
  name: nullableBoundedString(200),
  licenceIssueDate: nullableFormattedDate,
  licenceExpiryDate: nullableFormattedDate,
})
  .min(1)
  .required()
  .unknown(false);

export const deleteClientRelatedRecordQuerySchema = Joi.object({
  _id: Joi.string().trim().length(24).hex().required(),
  actionOn: Joi.string().valid(...CLIENT_RELATED_RECORD_ACTIONS).required(),
})
  .required()
  .unknown(false);

// Converts all Joi failures to the shared detail shape used by request validators.
// Centralizing this mapping keeps each related-record middleware concise and consistent.
const createValidationError = (validationDetails) =>
  new ClientRelatedRecordValidationError(
    validationDetails.map((detail) => ({
      field: detail.path.join(".") || "request",
      issue: detail.message,
    }))
  );

// Creates strict middleware for one related-record update body and MongoDB path id.
// Validated values are isolated so server-owned or unknown fields never reach persistence.
const createUpdateValidator = (bodySchema) => (req, _res, next) => {
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

// Creates strict middleware for a related-record body and its owning Client id.
// Reusing aggregate creation schemas keeps standalone and aggregate field rules aligned.
const createRelatedRecordValidator = (bodySchema) => (req, _res, next) => {
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

export {
  createClientDriverSchema,
  createClientMemberSchema,
  createClientVehicleSchema,
};
export const validateCreateClientMember = createRelatedRecordValidator(
  createClientMemberSchema
);
export const validateCreateClientVehicle = createRelatedRecordValidator(
  createClientVehicleSchema
);
export const validateCreateClientDriver = createRelatedRecordValidator(
  createClientDriverSchema
);

export const validateUpdateClientMember = createUpdateValidator(
  updateClientMemberSchema
);
export const validateUpdateClientVehicle = createUpdateValidator(
  updateClientVehicleSchema
);
export const validateUpdateClientDriver = createUpdateValidator(
  updateClientDriverSchema
);

// Validates the selected record type and MongoDB id supplied to the shared delete route.
// The strict action allow-list prevents callers from selecting arbitrary models or collections.
export const validateDeleteClientRelatedRecord = (req, _res, next) => {
  const { error, value } = deleteClientRelatedRecordQuerySchema.validate(
    req.query,
    {
      abortEarly: false,
      stripUnknown: false,
    }
  );

  if (error) {
    return next(createValidationError(error.details));
  }

  req.validatedQuery = value;
  return next();
};
