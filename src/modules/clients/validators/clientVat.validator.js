import Joi from "joi";
import { ClientServiceValidationError } from "../errors/clientService.error.js";
import { parseVatDate, VAT_SERVICE_CODE, VAT_STAGES } from "../utils/clientVat.utils.js";

const id = Joi.string().hex().length(24);
const text = Joi.string().trim().min(1).max(200);
const amount = Joi.string().pattern(/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/);
const signedAmount = Joi.string().pattern(/^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,2})?$/);
// Validates a real calendar date while preserving the existing Client date format.
// Conversion to a persisted Date happens only in the application service.
export const vatDateSchema = Joi.string().custom(function validateVatCalendarDate(value, helpers) {
  try { parseVatDate(value); return value; } catch { return helpers.error("any.invalid"); }
});
export const vatCreationFields = {
  serviceCode: Joi.string().valid(VAT_SERVICE_CODE),
  company: id,
  dueDate: vatDateSchema,
  assignedTo: id,
  details: Joi.object({ vat: Joi.object({ periodStart: vatDateSchema.required(), periodEnd: vatDateSchema.required() }).required().unknown(false) }).unknown(false),
};
const period = { periodStart: vatDateSchema.required(), periodEnd: vatDateSchema.required(), dueDate: vatDateSchema.required() };
const version = { expectedVersion: Joi.number().integer().min(0).max(Number.MAX_SAFE_INTEGER).required() };
const emptyAction = Joi.object(version).unknown(false).required();
export const vatActionSchemas = {
  prepare: Joi.object({ ...version, outputVat: signedAmount.required(), recoverableInputVat: signedAmount.required(), workingPaper: id.required(), sourceDocuments: Joi.array().items(id.required()).min(1).max(100).unique().required() }).unknown(false).required(),
  "request-review": emptyAction,
  "approve-review": emptyAction,
  "record-approval": Joi.object({ ...version, approverName: text.required(), document: id.required() }).unknown(false).required(),
  "record-submission": Joi.object({ ...version, reference: text.required(), submittedOn: vatDateSchema.required(), document: id.required() }).unknown(false).required(),
  "record-tax-payment": Joi.object({ ...version, amountPaid: amount.required(), paidOn: vatDateSchema.required(), document: id.required(), reason: Joi.string().trim().min(1).max(1000) }).unknown(false).required(),
  "return-for-correction": Joi.object({ ...version, reason: Joi.string().trim().min(1).max(1000).required() }).unknown(false).required(),
  cancel: Joi.object({ ...version, reason: Joi.string().trim().min(1).max(1000).required() }).unknown(false).required(),
  reopen: emptyAction,
  "revise-period": Joi.object({ ...version, ...period, reason: Joi.string().trim().min(1).max(1000).required() }).unknown(false).required(),
  "create-next-period": Joi.object({ ...version, ...period }).unknown(false).required(),
  assign: Joi.object({ ...version, assignedTo: id.required() }).unknown(false).required(),
  "schedule-reminder": Joi.object({ ...version, followupDate: vatDateSchema.required(), notes: Joi.array().items(Joi.string().trim().min(1).max(1000)).max(100).default([]) }).unknown(false).required(),
  "complete-reminder": emptyAction,
};
export const vatListSchema = Joi.object({
  serviceCode: Joi.string().valid(VAT_SERVICE_CODE).default(VAT_SERVICE_CODE),
  client: id, company: id, assignedTo: id, stage: Joi.string().valid(...VAT_STAGES),
  status: Joi.string().valid("Pending", "In Progress", "Completed", "Cancelled"),
  fromDate: vatDateSchema, toDate: vatDateSchema,
  page: Joi.number().integer().min(1).max(100000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
}).unknown(false);

// Creates strict validators for named VAT actions and scoped read endpoints.
// Only normalized values reach controllers, including an explicit version guard.
export const validateVatRequest = (action) => function validateVatInput(req, _res, next) {
  const schema = action === "list" ? vatListSchema : action === "detail" ? Joi.object({}).unknown(false) : vatActionSchemas[action];
  const result = schema.validate(action === "list" || action === "detail" ? req.query : req.body, { abortEarly: false });
  const params = action === "list" ? { value: {} } : Joi.object({ id: id.required() }).validate(req.params);
  const details = [...(result.error?.details ?? []), ...(params.error?.details ?? [])];
  if (details.length) return next(new ClientServiceValidationError(details.map((item) => ({ field: item.path.join("."), issue: item.message }))));
  req.validatedBody = result.value;
  req.validatedParams = params.value;
  return next();
};
