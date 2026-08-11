import Joi from "joi";

import { ValidationError } from "../errors/authentication.error.js";

const loginSchema = Joi.object({
  accessKey: Joi.string().length(12).required(),
}).required().unknown(false);

export const validateLogin = (req, _res, next) => {
  const { error, value } = loginSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join("."),
      issue: detail.message,
    }));
    return next(new ValidationError(details));
  }

  req.body = value;
  return next();
};
