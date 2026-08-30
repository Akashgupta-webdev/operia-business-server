import Joi from "joi";

import { ClientDetailValidationError } from "../errors/clientDetail.error.js";

export const clientMongoIdParamsSchema = Joi.object({
  id: Joi.string().trim().length(24).hex().required(),
})
  .required()
  .unknown(false);

export const getClientDetailsParamsSchema = clientMongoIdParamsSchema;

// Validates the Client MongoDB identifier before the detail service performs any lookup.
// The normalized parameters are stored separately from Express's unvalidated input.
export const validateGetClientDetails = (req, _res, next) => {
  const { error, value } = getClientDetailsParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "id",
      issue: detail.message,
    }));
    return next(new ClientDetailValidationError(details));
  }

  req.validatedParams = value;
  return next();
};
