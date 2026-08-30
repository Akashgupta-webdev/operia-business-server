import Joi from "joi";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import {
  ClientCreationValidationError,
  ClientPayloadSyntaxError,
} from "../errors/clientCreation.error.js";
import { ClientUpdateValidationError } from "../errors/clientUpdate.error.js";
import { CLIENT_DOCUMENT_TYPES } from "../models/clientDocuments.model.js";
import { CLIENT_MEMBER_TYPES } from "../models/clientMembers.model.js";
import {
  CLIENT_PAYMENT_METHODS,
  CLIENT_PAYMENT_STATUSES,
} from "../models/clientPayment.model.js";
import {
  CLIENT_REMINDER_PERIODS,
  CLIENT_REMINDER_PRIORITIES,
} from "../models/clientReminder.model.js";
import {
  CLIENT_SERVICE_CATEGORIES,
  CLIENT_SERVICE_PACKAGES,
  CLIENT_SERVICE_PAYMENT_STATUSES,
  CLIENT_SERVICE_STATUSES,
} from "../models/clientService.model.js";
import {
  CLIENT_STATUSES,
  CLIENT_TYPES,
  NATIONALITIES,
  PREFERRED_COMMUNICATION_METHODS,
} from "../models/client.model.js";
import { clientMongoIdParamsSchema } from "./clientParams.validator.js";

const MAX_RELATED_RECORDS = 100;
const MAX_DOCUMENTS = 10;
const nonEmptyString = Joi.string().trim().min(1);
const boundedString = (maximum = 200) => nonEmptyString.max(maximum);
const formattedDate = Joi.string()
  .trim()
  .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" });
const decimalAmount = Joi.string()
  .trim()
  .pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, { name: "decimal amount" });
const notesSchema = Joi.array()
  .items(boundedString(1000))
  .max(MAX_RELATED_RECORDS);

export const passportSchema = Joi.object({
  passportNumber: Joi.string().trim().uppercase().pattern(/^[A-Z]\d{7}$/),
  passportIssueDate: formattedDate,
  passportExpiryDate: formattedDate,
})
  .min(1)
  .unknown(false);

export const emiratesSchema = Joi.object({
  emiratesId: Joi.string().trim().pattern(/^784-\d{4}-\d{7}-\d$/),
  emiratesIssueDate: formattedDate,
  emiratesExpiryDate: formattedDate,
})
  .min(1)
  .unknown(false);

export const visaSchema = Joi.object({
  visaUIDNumber: Joi.string().trim().pattern(/^\d{9,15}$/),
  visaIssueDate: formattedDate,
  visaExpiryDate: formattedDate,
})
  .min(1)
  .unknown(false);

export const healthInsuranceSchema = Joi.object({
  healthInsuranceCardNumber: boundedString(100),
  healthInsuranceIssueDate: formattedDate,
  healthInsuranceExpiryDate: formattedDate,
})
  .min(1)
  .unknown(false);

const clientSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  nationality: Joi.string().valid(...NATIONALITIES),
  mobileNumber: boundedString(30),
  whatsappNumber: boundedString(30),
  emailAddress: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254),
  passport: passportSchema,
  emirates: emiratesSchema,
  visa: visaSchema,
  healthInsurance: healthInsuranceSchema,
  clientType: Joi.string()
    .valid(...CLIENT_TYPES)
    .default("INDIVIDUAL"),
})
  .required()
  .unknown(false);

const companySchema = Joi.object({
  companyName: Joi.string().trim().min(2).max(200).required(),
  tradeLicenceNumber: boundedString(100),
  licenceExpiryDate: formattedDate,
  vatTaxRegistrationNumber: boundedString(100),
  corporateTaxNumber: boundedString(100),
}).unknown(false);

export const createClientMemberSchema = Joi.object({
  memberType: Joi.string().valid(...CLIENT_MEMBER_TYPES),
  name: boundedString(200),
  passport: passportSchema,
  emirates: emiratesSchema,
  visa: visaSchema,
  healthInsurance: healthInsuranceSchema,
})
  .min(1)
  .unknown(false);

export const createClientVehicleSchema = Joi.object({
  registrationNumer: boundedString(100),
  tcNumber: boundedString(100),
  policyNumber: boundedString(100),
  registrationExpiry: formattedDate,
  insuranceExpiry: formattedDate,
})
  .min(1)
  .unknown(false);

export const createClientDriverSchema = Joi.object({
  name: boundedString(200),
  licenceIssueDate: formattedDate,
  licenceExpiryDate: formattedDate,
})
  .min(1)
  .unknown(false);

export const createClientServiceSchema = Joi.object({
  category: Joi.string().valid(...CLIENT_SERVICE_CATEGORIES),
  package: Joi.string().valid(...CLIENT_SERVICE_PACKAGES),
  status: Joi.string().valid(...CLIENT_SERVICE_STATUSES),
  packagePrice: decimalAmount,
  paymentStatus: Joi.string().valid(...CLIENT_SERVICE_PAYMENT_STATUSES),
  targetCompletionDate: formattedDate,
  notes: notesSchema,
})
  .min(1)
  .unknown(false);

const documentSchema = Joi.object({
  documentTitle: boundedString(200),
  documentType: Joi.string().valid(...CLIENT_DOCUMENT_TYPES).default("Other"),
  issueDate: formattedDate,
  expiryDate: formattedDate,
}).unknown(false);

const paymentSchema = Joi.object({
  totalBilled: decimalAmount,
  amountReceived: decimalAmount,
  paymentStatus: Joi.string().valid(...CLIENT_PAYMENT_STATUSES),
  paymentMethod: Joi.string().valid(...CLIENT_PAYMENT_METHODS),
  notes: notesSchema,
})
  .min(1)
  .unknown(false);

const reminderSchema = Joi.object({
  followupDate: formattedDate,
  remindBefore: Joi.string().valid(...CLIENT_REMINDER_PERIODS),
  priority: Joi.string().valid(...CLIENT_REMINDER_PRIORITIES),
  notes: notesSchema,
})
  .min(1)
  .unknown(false);

export const createClientPayloadSchema = Joi.object({
  client: clientSchema,
  company: Joi.when("client.clientType", {
    is: "COMPANY",
    then: companySchema.required(),
    otherwise: Joi.forbidden(),
  }),
  members: Joi.array()
    .items(createClientMemberSchema)
    .max(MAX_RELATED_RECORDS),
  vehicles: Joi.array()
    .items(createClientVehicleSchema)
    .max(MAX_RELATED_RECORDS),
  drivers: Joi.array()
    .items(createClientDriverSchema)
    .max(MAX_RELATED_RECORDS),
  services: Joi.array()
    .items(createClientServiceSchema)
    .max(MAX_RELATED_RECORDS),
  documents: Joi.array().items(documentSchema).max(MAX_DOCUMENTS),
  payments: Joi.array().items(paymentSchema).max(MAX_RELATED_RECORDS),
  reminders: Joi.array().items(reminderSchema).max(MAX_RELATED_RECORDS),
})
  .required()
  .unknown(false);

export const updateClientInformationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200),
  mobileNumber: boundedString(30).allow(null),
  whatsappNumber: boundedString(30).allow(null),
  emailAddress: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(254)
    .allow(null),
  nationality: Joi.string().valid(...NATIONALITIES),
  clientType: Joi.string().valid(...CLIENT_TYPES),
  status: Joi.string().valid(...CLIENT_STATUSES),
  preferredCommunicationMethod: Joi.string().valid(
    ...PREFERRED_COMMUNICATION_METHODS
  ),
  passport: passportSchema.allow(null),
  emirates: emiratesSchema.allow(null),
  visa: visaSchema.allow(null),
  healthInsurance: healthInsuranceSchema.allow(null),
})
  .min(1)
  .required()
  .unknown(false);

// Parses the multipart JSON field while also allowing direct JSON requests when no files are needed.
// Keeping parsing here ensures the controller receives one validated payload shape for both transports.
const parseClientPayload = (req) => {
  if (typeof req.body?.payload === "string") {
    try {
      return JSON.parse(req.body.payload);
    } catch {
      throw new ClientPayloadSyntaxError();
    }
  }

  if (req.body?.payload && typeof req.body.payload === "object") {
    return req.body.payload;
  }

  if (req.is("application/json")) {
    return req.body;
  }

  return undefined;
};

// Validates every client aggregate section and verifies file metadata remains positionally aligned.
// The validated value is stored separately so client-supplied references cannot reach persistence.
export const validateCreateClient = (req, _res, next) => {
  let payload;

  try {
    payload = parseClientPayload(req);
  } catch (error) {
    return next(error);
  }

  const { error, value } = createClientPayloadSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: false,
  });
  const details = (error?.details ?? []).map((detail) => ({
    field: detail.path.join(".") || "payload",
    issue: detail.message,
  }));
  const fileCount = req.files?.length ?? 0;
  const metadataCount = value?.documents?.length ?? 0;

  if (metadataCount > 0 && metadataCount !== fileCount) {
    details.push({
      field: "documents",
      issue: "documents metadata must contain exactly one item for each uploaded file.",
    });
  }

  if (details.length > 0) {
    return next(new ClientCreationValidationError(details));
  }

  req.validatedPayload = value;
  return next();
};

// Validates the Client MongoDB id and partial information body before controller execution.
// Normalized values are stored separately so raw or unknown request fields never reach persistence.
export const validateUpdateClientInformation = (req, _res, next) => {
  const paramsResult = clientMongoIdParamsSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: false,
  });
  const bodyResult = updateClientInformationSchema.validate(req.body, {
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
    return next(new ClientUpdateValidationError(details));
  }

  req.validatedParams = paramsResult.value;
  req.validatedBody = bodyResult.value;
  return next();
};
