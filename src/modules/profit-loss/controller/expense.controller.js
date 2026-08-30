import logger from "../../../logger/index.js";
import { ExpenseValidationError } from "../errors/expense.error.js";
import { createExpense as createExpenseRecord } from "../service/expense.service.js";

// Converts model validation failures into the same field-addressable contract as Joi failures.
// This protects the API if persistence constraints become stricter than boundary validation.
const normalizeExpenseError = (error) =>
  error.name === "ValidationError"
    ? new ExpenseValidationError(
        Object.entries(error.errors).map(([field, validationError]) => ({
          field,
          issue: validationError.message,
        }))
      )
    : error;

// Creates one validated Expense and returns it in the standard resource envelope.
// Errors are safely logged without financial details and delegated to shared error handling.
export const createExpense = async (req, res, next) => {
  try {
    const expense = await createExpenseRecord(req.validatedBody);
    const expenseId = expense._id.toString();

    logger.info("Expense created.", {
      expenseId,
      actorId: req.user.id,
      correlationId: req.correlationId,
    });

    res.location(`/api/v1/profit-loss/expense/${expenseId}`);
    res.set("ETag", `"${expense.version}"`);
    return res.status(201).json({
      data: expense,
      meta: { correlationId: req.correlationId },
    });
  } catch (error) {
    const responseError = normalizeExpenseError(error);
    console.error("Expense creation failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
    });
    logger.error("Expense creation failed.", {
      errorName: responseError.name,
      errorCode: responseError.code,
      actorId: req.user?.id,
      correlationId: req.correlationId,
    });
    return next(responseError);
  }
};
