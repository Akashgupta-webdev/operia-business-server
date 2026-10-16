import Joi from "joi";
import { COMPANY_CERTIFICATE_NUMBER_PATTERN, isValidCompanyCertificateExpiry } from "../utils/clientCompanyCertificate.utils.js";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import { ClientCompanyUpdateValidationError } from "../errors/clientCompanyUpdate.error.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

const nullableBoundedString = (maximum) =>
  Joi.string().trim().min(1).max(maximum).allow(null);

export const updateNextVATorTAXDueDateSchema = Joi.object({
  nextVATDue: Joi.date().iso(),
  nextTAXDue: Joi.date().iso(),
}).min(1).required().unknown(false);

const companyIdParamsSchema = Joi.object({
  companyId: clientMongoIdParamsSchema.extract("id"),
}).required().unknown(false);

// Validates the Company identifier and optional ISO compliance due dates.
// Rejects empty or unknown updates and keeps normalized input separate from raw input.
export const validateUpdateNextVATorTAXDueDate = (req, _res, next) => {
  const options = { abortEarly: false, stripUnknown: false };
  const params = companyIdParamsSchema.validate(req.params, options);
  const body = updateNextVATorTAXDueDateSchema.validate(req.body, options);
  const details = [...(params.error?.details ?? []), ...(body.error?.details ?? [])];
  if (details.length) {
    return next(new ClientCompanyUpdateValidationError(details.map((detail) => ({
      field: detail.path.join(".") || "body",
      issue: detail.message,
    }))));
  }
  req.validatedParams = params.value;
  req.validatedBody = body.value;
  return next();
};
const nullableFormattedDate = Joi.string()
  .trim()
  .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" })
  .allow(null);

export const updateClientCompanyInformationSchema = Joi.object({
  civilDefenceCertificate: Joi.object({
    certificationNo: nullableBoundedString(100).pattern(COMPANY_CERTIFICATE_NUMBER_PATTERN),
    expiryDate: nullableFormattedDate.custom(validateCompanyCertificateExpiry),
  }).min(1).allow(null).unknown(false),
  commercialTradeLicence: Joi.object({
    licenceNo: nullableBoundedString(100).pattern(COMPANY_CERTIFICATE_NUMBER_PATTERN),
    expiryDate: nullableFormattedDate.custom(validateCompanyCertificateExpiry),
  }).min(1).allow(null).unknown(false),
  companyName: Joi.string().trim().min(2).max(200),
  tradeLicence: Joi.object({
    tradeLicenceNo: nullableBoundedString(100),
    tradeLicenceExpiry: nullableFormattedDate,
  }).min(1).allow(null).unknown(false),
  establishment: Joi.object({
    establishmentCard: nullableBoundedString(100),
    establishmentCardExpiry: nullableFormattedDate,
  }).min(1).allow(null).unknown(false),
  vatTaxRegistrationNumber: nullableBoundedString(100),
  corporateTaxNumber: nullableBoundedString(100),
})
  .min(1)
  .required()
  .unknown(false);

// Applies the same real-calendar expiry rule as the Company model before persistence.
// Returning the original string keeps the existing API and renewal date representation.
function validateCompanyCertificateExpiry(value, helpers) {
  return isValidCompanyCertificateExpiry(value) ? value : helpers.error("any.invalid");
}

// Validates the owning Client id and partial Company body before controller execution.
// Normalized values are isolated so unknown and server-managed fields cannot be persisted.
export const validateUpdateClientCompanyInformation = (req, _res, next) => {
  const paramsResult = clientMongoIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const bodyResult = updateClientCompanyInformationSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });
  const validationDetails = [
    ...(paramsResult.error?.details ?? []),
    ...(bodyResult.error?.details ?? []),
  ];

  if (validationDetails.length > 0) {
    const details = validationDetails.map((detail) => ({
      field: detail.path.join(".") || "body",
      issue: detail.message,
    }));
    return next(new ClientCompanyUpdateValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedBody = bodyResult.value;
  return next();
};
