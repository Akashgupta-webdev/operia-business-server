import Joi from "joi";

import {
  CLIENT_TYPES,
  CLIENT_STATUSES,
  PREFERRED_COMMUNICATION_METHODS,
} from "../models/client.model.js";
import {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
} from "../../common/models/service.model.js";
import {
  COMPANY_STATUSES,
  COMPANY_TYPES,
} from "../../company/models/company.model.js";
import { ClientValidationError } from "../errors/client.error.js";

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

const requiredContactNumberSchema = Joi.string().trim().min(1).max(30).required();
const requiredEmailSchema = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: { allow: false } })
  .max(254)
  .required();

const completeClientSchema = Joi.object({
  clientType: Joi.string().valid(...CLIENT_TYPES).required(),
  name: Joi.string().trim().min(2).max(200).required(),
  mobileNumber: requiredContactNumberSchema,
  whatsappNumber: requiredContactNumberSchema,
  emailAddress: requiredEmailSchema,
  nationality: Joi.string().trim().min(1).max(120).required(),
  passportNumber: Joi.string().trim().min(1).max(30).required(),
  emiratesIdNumber: Joi.string().trim().min(1).max(30).required(),
  address: Joi.string().trim().min(1).max(500),
  preferredCommunicationMethod: Joi.string()
    .valid(...PREFERRED_COMMUNICATION_METHODS)
    .required(),
  notes: Joi.string().trim().min(1).max(5000),
  clientStatus: Joi.string().valid(...CLIENT_STATUSES),
}).unknown(false);

const completeCompanySchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(200).required(),
  tradeName: Joi.string().trim().min(1).max(200),
  legalName: Joi.string().trim().min(1).max(200),
  companyType: Joi.string().valid(...COMPANY_TYPES).required(),
  freeZoneName: Joi.string().trim().min(1).max(200),
  licence: Joi.object({
    number: Joi.string().trim().min(1).max(100).required(),
    activity: Joi.string().trim().min(1).max(500),
    issueDate: Joi.date().iso(),
    expiryDate: Joi.date().iso().required(),
  })
    .required()
    .unknown(false),
  establishment: Joi.object({
    cardNumber: Joi.string().trim().min(1).max(100),
    cardExpiryDate: Joi.date().iso(),
  }).unknown(false),
  vatTrnNumber: Joi.string().trim().min(1).max(100),
  corporateTaxRegistrationNumber: Joi.string().trim().min(1).max(100),
  companyEmail: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254),
  companyMobile: Joi.string().trim().min(1).max(30),
  address: Joi.string().trim().min(1).max(500),
  bankName: Joi.string().trim().min(1).max(200),
  accountName: Joi.string().trim().min(1).max(200),
  iban: Joi.string().trim().uppercase().min(1).max(34),
  accountNumber: Joi.string().trim().min(1).max(100),
  companyStatus: Joi.string().valid(...COMPANY_STATUSES),
  notes: Joi.array().items(Joi.string().trim().min(1).max(5000)),
}).unknown(false);

const completeServiceSchema = Joi.object({
  category: Joi.string().valid(...SERVICE_CATEGORIES).required(),
  status: Joi.string().valid(...SERVICE_STATUSES).required(),
  detail: Joi.object().min(1).required().unknown(true),
})
  .required()
  .unknown(false);

const paymentSchema = Joi.object({
  governmentFee: Joi.string().trim().pattern(/^\d+(?:\.\d+)?$/).required(),
  serviceFee: Joi.string().trim().pattern(/^\d+(?:\.\d+)?$/).required(),
  totalAmount: Joi.string().trim().pattern(/^\d+(?:\.\d+)?$/).required(),
  amountReceived: Joi.string().trim().pattern(/^\d+(?:\.\d+)?$/).required(),
  paymentMethod: Joi.string().trim().min(1).max(50).required(),
  paymentDate: Joi.date().iso().required(),
  paymentStatus: Joi.string().trim().min(1).max(50).required(),
}).unknown(false);

const reminderSchema = Joi.object({
  dueDate: Joi.date().iso().required(),
  reminderBefore: Joi.number().integer().min(0).required(),
  followUpsDate: Joi.date().iso().required(),
  notes: Joi.string().trim().min(1).max(5000),
}).unknown(false);

export const createClientWithServiceSchema = Joi.object({
  client: completeClientSchema.required(),
  company: Joi.when("client.clientType", {
    is: "COMPANY",
    then: completeCompanySchema.required(),
    otherwise: Joi.forbidden(),
  }),
  service: completeServiceSchema,
  payment: paymentSchema,
  reminder: reminderSchema,
})
  .required()
  .unknown(false);

export const validateCreateClientWithService = (req, _res, next) => {
  let payload;

  try {
    payload = typeof req.body.payload === "string"
      ? JSON.parse(req.body.payload)
      : req.body.payload;
  } catch {
    return next(
      new ClientValidationError([
        { field: "payload", issue: "payload must contain valid JSON." },
      ])
    );
  }

  const { error, value } = createClientWithServiceSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "payload",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.validatedPayload = value;
  return next();
};

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

const updateClientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  emiratesIdNumber: Joi.string().trim().min(1).max(30),
  emailAddress: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254),
  mobileNumber: contactNumberSchema,
  whatsappNumber: contactNumberSchema,
  clientType: Joi.string().valid(...CLIENT_TYPES),
  nationality: Joi.string().trim().min(1).max(120),
  passportNumber: Joi.string().trim().min(1).max(30),
  address: Joi.string().trim().min(1).max(500).allow(null),
  preferredCommunicationMethod: Joi.string().valid(
    ...PREFERRED_COMMUNICATION_METHODS
  ),
  clientStatus: Joi.string().valid(...CLIENT_STATUSES),
})
  .min(1)
  .required()
  .unknown(false);

export const validateUpdateClient = (req, _res, next) => {
  const paramsResult = clientIdSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const bodyResult = updateClientSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });
  const validationDetails = [
    ...(paramsResult.error?.details ?? []),
    ...(bodyResult.error?.details ?? []),
  ];

  if (validationDetails.length) {
    const details = validationDetails.map((detail) => ({
      field: detail.path.join(".") || "body",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedBody = bodyResult.value;
  return next();
};

const clientServiceParamsSchema = Joi.object({
  clientId: Joi.string().trim().min(1).max(128).required(),
  serviceId: Joi.string().trim().hex().length(24).required(),
})
  .required()
  .unknown(false);

export const validateGetClientService = (req, _res, next) => {
  const { error, value } = clientServiceParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "params",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.validatedParams = value;
  return next();
};

const clientServicesParamsSchema = Joi.object({
  clientMongoId: Joi.string().trim().hex().length(24).required(),
})
  .required()
  .unknown(false);

const clientServicesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
})
  .required()
  .unknown(false);

export const validateListClientServices = (req, _res, next) => {
  const paramsResult = clientServicesParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const queryResult = clientServicesQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });
  const validationDetails = [
    ...(paramsResult.error?.details ?? []),
    ...(queryResult.error?.details ?? []),
  ];

  if (validationDetails.length) {
    const details = validationDetails.map((detail) => ({
      field: detail.path.join(".") || "request",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedQuery = queryResult.value;
  return next();
};

const editClientServiceParamsSchema = Joi.object({
  clientMongoId: Joi.string().trim().hex().length(24).required(),
  serviceId: Joi.string().trim().hex().length(24).required(),
})
  .required()
  .unknown(false);

const editClientServiceBodySchema = Joi.object({
  category: Joi.string().valid(...SERVICE_CATEGORIES),
  status: Joi.string().valid(...SERVICE_STATUSES),
  detail: Joi.object().min(1).unknown(true),
})
  .min(1)
  .required()
  .unknown(false);

export const validateEditClientService = (req, _res, next) => {
  const paramsResult = editClientServiceParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const bodyResult = editClientServiceBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });
  const validationDetails = [
    ...(paramsResult.error?.details ?? []),
    ...(bodyResult.error?.details ?? []),
  ];

  if (validationDetails.length) {
    const details = validationDetails.map((detail) => ({
      field: detail.path.join(".") || "body",
      issue: detail.message,
    }));
    return next(new ClientValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedBody = bodyResult.value;
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
