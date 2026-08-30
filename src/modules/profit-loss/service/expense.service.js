import Expense from "../model/expense.model.js";

// Converts the optional validated date-only string into a deterministic UTC Date value.
// All other normalized Expense fields pass through unchanged to Mongoose persistence.
const buildExpenseRecord = (expenseInformation) => ({
  ...expenseInformation,
  ...(expenseInformation.expenseDate
    ? {
        expenseDate: new Date(
          `${expenseInformation.expenseDate}T00:00:00.000Z`
        ),
      }
    : {}),
});

// Creates one Expense using the Joi-normalized request fields.
// Database access remains in the Profit and Loss service layer.
export const createExpense = async (expenseInformation) =>
  Expense.create(buildExpenseRecord(expenseInformation));
