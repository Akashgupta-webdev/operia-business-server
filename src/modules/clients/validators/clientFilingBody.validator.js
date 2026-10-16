import Joi from "joi";
import { CLIENT_FILING_STATUSES } from "../models/clientFiling.schema.js";
import { ClientFilingError } from "../errors/clientFiling.error.js";
import { parseVatDate, vatMinorUnits } from "../utils/clientVat.utils.js";

// Validates monetary inputs using the same exact decimal policy as filing persistence.
// Returns decimal strings so JSON numbers and strings share model validation rules.
function validateFilingAmount(value, helpers) {
  try {
    vatMinorUnits(value);
    return String(value);
  } catch {
    return helpers.error("any.invalid");
  }
}

// Parses the existing dd-mm-yyyy format with real-calendar validation.
// ISO inputs are handled separately by Joi's ISO date schema.
function validateFilingCalendarDate(value, helpers) {
  try {
    return parseVatDate(value);
  } catch {
    return helpers.error("any.invalid");
  }
}

const amount = Joi.alternatives().try(Joi.string(), Joi.number()).custom(validateFilingAmount);
const date = Joi.alternatives().try(
  Joi.string().pattern(/^\d{2}-\d{2}-\d{4}$/).custom(validateFilingCalendarDate),
  Joi.date().iso()
);
const period = Joi.string().trim().pattern(/^(0[1-9]|1[0-2])-\d{4}$/);
const fields = {
  periodStart: period,
  periodEnd: period,
  status: Joi.string().valid(...CLIENT_FILING_STATUSES),
  input: amount,
  output: amount,
  filingDate: date,
  nextDueDate: date,
};
export const createFilingSchema = Joi.object(fields)
  .fork(["periodStart", "periodEnd", "input", "output", "nextDueDate"], (field) => field.required())
  .required().unknown(false);
export const updateFilingSchema = Joi.object(fields).min(1).required().unknown(false);
const identifier = Joi.string().trim().hex().length(24).required();

// Selects strict parameter and body schemas for each standalone filing operation.
// Only normalized allow-listed values reach controllers and persistence services.
export function validateFilingWrite(action) {
  // Validates the company or filing id and collects every body validation issue.
  // Delete accepts no payload fields; create and update reject ownership and notes fields.
  return function validateFilingWriteRequest(req, _res, next) {
    const options = { abortEarly: false, stripUnknown: false };
    const paramsSchema = Joi.object(action === "create" ? { companyId: identifier } : { id: identifier }).required().unknown(false);
    const bodySchema = action === "create" ? createFilingSchema : action === "update" ? updateFilingSchema : Joi.object({}).unknown(false);
    const params = paramsSchema.validate(req.params, options);
    const body = bodySchema.validate(req.body, options);
    const issues = [...(params.error?.details ?? []), ...(body.error?.details ?? [])];
    if (issues.length) {
      return next(new ClientFilingError("VALIDATION_FAILED", "The filing request is invalid.", 422,
        issues.map((issue) => ({ field: issue.path.join(".") || "body", issue: issue.message }))));
    }
    req.validatedParams = params.value;
    req.validatedBody = body.value;
    return next();
  };
}
