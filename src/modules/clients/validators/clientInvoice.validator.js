import { UAE_EMIRATES, UAE_CONTACT_PATTERN } from "../utils/clientInvoice.utils.js";
import Joi from "joi";
import { CLIENT_INVOICE_TAX_CODES, CLIENT_INVOICE_TYPES } from "../models/clientInvoice.model.js";
import { ClientInvoiceError } from "../errors/clientInvoice.error.js";

const identifier = Joi.string().hex().length(24);
const amount = Joi.string().pattern(/^\d{1,16}(?:\.\d{1,2})?$/);
const item = Joi.object({
  itemDescription: Joi.string().trim().required(),
  qty: Joi.number().positive().required(),
  govtRate: amount.required(), servicePrice: amount.required(),
  taxCode: Joi.number().valid(...CLIENT_INVOICE_TAX_CODES).required(),
  taxAmount: amount.required(), grandTotal: amount.required(),
}).unknown(false);
const fields = {
  companyId: identifier,
  invoiceType: Joi.string().valid(...CLIENT_INVOICE_TYPES),
  customerName: Joi.string().trim(),
  emirate: Joi.string().valid(...UAE_EMIRATES),
  contactNo: Joi.string().trim().pattern(UAE_CONTACT_PATTERN),
  fullAddress: Joi.string().trim(), emailAddress: Joi.string().trim().email(),
  issueDate: Joi.date().iso(), dueDate: Joi.date().iso(),
  service: Joi.array().items(item).min(1).max(100),
  accountNo: Joi.string().trim(), switftBIC: Joi.string().trim(), iban: Joi.string().trim(),
};
export const createInvoiceSchema = Joi.object({
  ...fields,
  clientId: identifier.required(),
  companyId: identifier.required(),
  invoiceType: fields.invoiceType.required(),
  customerName: fields.customerName.required(),
  fullAddress: fields.fullAddress.required(),
  trnNo: Joi.string().trim().required(),
  emailAddress: fields.emailAddress.required(),
  issueDate: fields.issueDate.required(),
  dueDate: fields.dueDate.required(),
  service: fields.service.required(),
}).required().unknown(false);
export const updateInvoiceSchema = Joi.object({
  ...fields, expectedVersion: Joi.number().integer().min(0).required(),
}).min(2).required().unknown(false);
export const invoiceQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).max(1000000).default(1),
  limit: Joi.number().integer().min(1).max(100).default(25),
  search: Joi.string().trim().max(200).allow("").default(""),
}).unknown(false);

// Selects strict request schemas for the route's fixed invoice operation.
// Server-managed identifiers, numbers and timestamps never enter write payloads.
export function validateInvoiceRequest(action) {
  // Normalizes parameters, pagination and payload before calling the controller.
  // Collects field errors in the project's standard validation response shape.
  return function validateClientInvoiceRequest(req, _res, next) {
    const options = { abortEarly: false, stripUnknown: false };
    const params = Joi.object(["detail", "update", "delete"].includes(action)
      ? { id: identifier.required() } : {}).unknown(false).validate(req.params, options);
    const bodySchema = action === "create" ? createInvoiceSchema
      : action === "update" ? updateInvoiceSchema : Joi.object({}).unknown(false);
    const querySchema = action === "list" ? invoiceQuerySchema
      : action === "delete" ? Joi.object({ expectedVersion: Joi.number().integer().min(0).required() }).unknown(false)
        : Joi.object({}).unknown(false);
    const body = bodySchema.validate(req.body, options);
    const query = querySchema.validate(req.query, options);
    const issues = [params, body, query].flatMap((result) => result.error?.details ?? []);
    if (issues.length) return next(new ClientInvoiceError("VALIDATION_FAILED", "The invoice request is invalid.", 422,
      issues.map((issue) => ({ field: issue.path.join("."), issue: issue.message }))));
    req.validatedParams = params.value;
    req.validatedBody = body.value;
    req.validatedQuery = query.value;
    return next();
  };
}
