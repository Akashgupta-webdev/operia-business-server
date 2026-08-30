import Joi from "joi";

import { ExpenseValidationError } from "../errors/expense.error.js";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from "../model/expense.model.js";

const EXPENSE_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// Rejects impossible YYYY-MM-DD calendar dates after their string shape is validated.
// UTC component comparison prevents locale and daylight-saving behavior from affecting input.
const validateExpenseCalendarDate = (value, helpers) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return helpers.error("date.format");
  }

  return value;
};

export const createExpenseBodySchema = Joi.object({
  expenseTitle: Joi.string().trim().min(1).max(200).required(),
  expenseCategory: Joi.string()
    .valid(...EXPENSE_CATEGORIES)
    .required(),
  expenseAmount: Joi.string()
    .trim()
    .pattern(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, {
      name: "non-negative decimal amount",
    }),
  expenseDate: Joi.string()
    .trim()
    .pattern(EXPENSE_DATE_PATTERN, { name: "YYYY-MM-DD" })
    .custom(validateExpenseCalendarDate, "Expense calendar date validation")
    .messages({
      "date.format": "{{#label}} must contain a valid calendar date",
    }),
  paymentMethod: Joi.string().valid(...EXPENSE_PAYMENT_METHODS),
  vendorName: Joi.string().trim().min(1).max(200),
  receiptReference: Joi.string().trim().min(1).max(200),
  notes: Joi.string().trim().min(1).max(2000),
})
  .required()
  .unknown(false);

// Validates and normalizes an Expense body while rejecting every unknown write field.
// The normalized value is stored separately so raw input never reaches persistence.
export const validateCreateExpense = (req, _res, next) => {
  const { error, value } = createExpenseBodySchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "body",
      issue: detail.message,
    }));
    return next(new ExpenseValidationError(details));
  }

  req.validatedBody = value;
  return next();
};
