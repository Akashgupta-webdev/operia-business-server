import Joi from "joi";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import { ClientCompanyUpdateValidationError } from "../errors/clientCompanyUpdate.error.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

const nullableBoundedString = (maximum) =>
  Joi.string().trim().min(1).max(maximum).allow(null);
const nullableFormattedDate = Joi.string()
  .trim()
  .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" })
  .allow(null);

export const updateClientCompanyInformationSchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(200),
  tradeLicenceNumber: nullableBoundedString(100),
  licenceExpiryDate: nullableFormattedDate,
  vatTaxRegistrationNumber: nullableBoundedString(100),
  corporateTaxNumber: nullableBoundedString(100),
})
  .min(1)
  .required()
  .unknown(false);

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
