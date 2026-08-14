import Joi from "joi";

import {
  COMPANY_STATUSES,
  COMPANY_TYPES,
} from "../models/company.model.js";

const optionalText = (maximum) => Joi.string().trim().min(1).max(maximum);

const licenceSchema = Joi.object({
  number: optionalText(100),
  activity: optionalText(500),
  issueDate: Joi.date().iso(),
  expiryDate: Joi.date().iso(),
}).unknown(false);

const establishmentSchema = Joi.object({
  cardNumber: optionalText(100),
  cardExpiryDate: Joi.date().iso(),
}).unknown(false);

export const createCompanySchema = Joi.object({
  client: Joi.string().trim().hex().length(24).required(),
  companyName: Joi.string().trim().min(2).max(200).required(),
  tradeName: optionalText(200),
  legalName: optionalText(200),
  companyType: Joi.string()
    .valid(...COMPANY_TYPES)
    .required(),
  freeZoneName: optionalText(200),
  licence: licenceSchema,
  establishment: establishmentSchema,
  vatTrnNumber: optionalText(100),
  corporateTaxRegistrationNumber: optionalText(100),
  companyEmail: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254),
  companyMobile: optionalText(30),
  address: optionalText(500),
  bankName: optionalText(200),
  accountName: optionalText(200),
  iban: Joi.string().trim().uppercase().min(1).max(34),
  accountNumber: optionalText(100),
  companyStatus: Joi.string().valid(...COMPANY_STATUSES),
  notes: Joi.array().items(optionalText(5000)),
})
  .required()
  .unknown(false);

class CompanyValidationError extends Error {
  constructor(details) {
    super("The company request is invalid.");
    this.name = "CompanyValidationError";
    this.status = 422;
    this.code = "VALIDATION_FAILED";
    this.details = details;
  }
}

export const validateCreateCompany = (req, _res, next) => {
  const { error, value } = createCompanySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "body",
      issue: detail.message,
    }));
    return next(new CompanyValidationError(details));
  }

  req.body = value;
  return next();
};

const clientIdParamsSchema = Joi.object({
  clientId: Joi.string().trim().hex().length(24).required(),
})
  .required()
  .unknown(false);

export const listCompaniesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
})
  .required()
  .unknown(false);

export const validateListCompaniesQuery = (req, _res, next) => {
  const { error, value } = listCompaniesQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new CompanyValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};

export const validateGetCompaniesByClient = (req, _res, next) => {
  const paramsResult = clientIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const queryResult = listCompaniesQuerySchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: false,
  });
  const errors = [
    ...(paramsResult.error?.details ?? []),
    ...(queryResult.error?.details ?? []),
  ];

  if (errors.length > 0) {
    const details = errors.map((detail) => ({
      field: detail.path.join(".") || "request",
      issue: detail.message,
    }));
    return next(new CompanyValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedQuery = queryResult.value;
  return next();
};
