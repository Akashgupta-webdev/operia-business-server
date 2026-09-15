import { ValidationError } from "../../authentication/errors/authentication.error.js";
import { updateClientCredentialsSchema } from "./clientCredentials.validator.js";

export const clientLoginSchema = updateClientCredentialsSchema.fork(
  ["emailAddress", "password"],
  (schema) => schema.required()
);

// Requires both credentials while reusing the documented email and password constraints.
// Fixed errors never echo passwords or unknown request values into the response.
export const validateClientLogin = (req, _res, next) => {
  const { error, value } = clientLoginSchema.validate(req.body, { abortEarly: false });
  if (error) {
    return next(new ValidationError([{
      field: "credentials",
      issue: "Supply only a valid emailAddress and password (8 characters minimum, 72 UTF-8 bytes maximum).",
    }]));
  }
  req.validatedBody = value;
  return next();
};
