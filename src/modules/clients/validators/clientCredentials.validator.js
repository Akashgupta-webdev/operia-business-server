import Joi from "joi";
import { ClientUpdateValidationError } from "../errors/clientUpdate.error.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

export const updateClientCredentialsSchema = Joi.object({
  emailAddress: Joi.string().trim().lowercase().email({ tlds: { allow: false } }).max(254),
  password: Joi.string().min(8).custom(function validatePasswordByteLength(value, helpers) {
    // Preserves the documented password size limit without trimming the supplied value.
    // Measures Unicode passwords in UTF-8 bytes to keep request validation consistent.
    return Buffer.byteLength(value, "utf8") <= 72 ? value : helpers.error("any.invalid");
  }),
}).min(1).required().unknown(false);

// Validates the target and credential allow-list before any database access.
// Fixed validation messages prevent rejected credential values from being echoed.
export const validateUpdateClientCredentials = (req, _res, next) => {
  const options = { abortEarly: false, stripUnknown: false };
  const params = clientMongoIdParamsSchema.validate(req.params, options);
  const body = updateClientCredentialsSchema.validate(req.body, options);
  const errors = [...(params.error?.details ?? []), ...(body.error?.details ?? [])];
  if (errors.length) {
    return next(new ClientUpdateValidationError(errors.map(() => ({
      field: "credentials",
      issue: "Supply a valid client id and emailAddress or password (8 characters minimum, 72 UTF-8 bytes maximum); no other fields are allowed.",
    }))));
  }
  req.validatedParams = params.value;
  req.validatedBody = body.value;
  return next();
};
