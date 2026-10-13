import Joi from "joi";
import { getClientCompaniesQuerySchema } from "./clientCompanyQuery.validator.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";
import { ClientUpdateValidationError } from "../errors/clientUpdate.error.js";

export const clientComplianceBodySchema = Joi.object({
  _id: clientMongoIdParamsSchema.extract("id"),
}).required().unknown(false);

// Validates compliance list queries or the client identifier for membership changes.
// Reuses the module's pagination rules and rejects any unknown input fields.
export const validateClientCompliance = (source) => {
  const schema = source === "query" ? getClientCompaniesQuerySchema : clientComplianceBodySchema;
  return function validateClientComplianceRequest(req, _res, next) {
    const { error, value } = schema.validate(req[source], { abortEarly: false });
    if (error) {
      const responseError = new ClientUpdateValidationError(error.details.map((detail) => ({
        field: detail.path.join(".") || source,
        issue: detail.message,
      })));
      responseError.message = "The client compliance service request is invalid.";
      return next(responseError);
    }
    req[source === "query" ? "validatedQuery" : "validatedBody"] = value;
    return next();
  };
};
