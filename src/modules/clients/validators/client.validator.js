import Joi from "joi";

import {
  CLIENT_STATUSES,
  PREFERRED_COMMUNICATION_METHODS,
} from "../models/client.model.js";

const contactNumberSchema = Joi.string().trim().min(1).max(30);

export const createClientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  mobileNumber: contactNumberSchema,
  whatsappNumber: contactNumberSchema,
  emailAddress: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254),
  nationality: Joi.string().trim().min(1).max(120),
  emiratesIdNumber: Joi.string().trim().min(1).max(30),
  passportNumber: Joi.string().trim().min(1).max(30),
  address: Joi.string().trim().min(1).max(500),
  preferredCommunicationMethod: Joi.string()
    .valid(...PREFERRED_COMMUNICATION_METHODS)
    .required(),
  notes: Joi.string().trim().min(1).max(5000),
  clientStatus: Joi.string().valid(...CLIENT_STATUSES),
})
  .or("mobileNumber", "whatsappNumber", "emailAddress")
  .required()
  .unknown(false);

class ClientValidationError extends Error {
  constructor(details) {
    super("The client request is invalid.");
    this.name = "ClientValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export const validateCreateClient = (req, _res, next) => {
  const { error, value } = createClientSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field:
        detail.path.join(".") ||
        detail.context?.peers?.join("|") ||
        "body",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.body = value;
  return next();
};

const clientIdSchema = Joi.object({
  clientId: Joi.string().trim().min(1).max(128).required(),
})
  .required()
  .unknown(false);

export const validateClientId = (req, _res, next) => {
  const { error, value } = clientIdSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "clientId",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.params = value;
  return next();
};

export const listClientsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  search: Joi.string().trim().min(1).max(100),
})
  .required()
  .unknown(false);

export const validateListClientsQuery = (req, _res, next) => {
  const { error, value } = listClientsQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};
