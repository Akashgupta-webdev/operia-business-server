import mongoose from "mongoose";

import { createModelOptions } from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

export const EXPENSE_CATEGORIES = Object.freeze([
  "Government & Authority Fees",
  "Typing & Amer Centers",
  "PRO Processing & Courier",
  "Office Rent & Utilities",
  "Software & Cloud Tools",
  "Salaries & Professional Fees",
  "Miscellaneous Operations",
]);

export const EXPENSE_PAYMENT_METHODS = Object.freeze([
  "Bank Transfer / Online",
  "Corporate Credit Card",
  "Cash / Petty Cash",
  "PRO Reimbursement",
]);

// Verifies an optional Decimal128 Expense amount is not below zero.
// Exact decimal storage avoids binary floating-point errors in financial records.
const isNonNegativeExpenseAmount = (value) =>
  value == null || Number(value.toString()) >= 0;

const expenseSchema = new Schema(
  {
    expenseTitle: {
      type: String,
      trim: true,
      required: [true, "Expense title is required."],
      maxlength: [200, "Expense title cannot exceed 200 characters."],
    },
    expenseCategory: {
      type: String,
      required: [true, "Expense category is required."],
      enum: {
        values: EXPENSE_CATEGORIES,
        message: "Expense category is invalid.",
      },
    },
    expenseAmount: {
      type: Schema.Types.Decimal128,
      validate: {
        validator: isNonNegativeExpenseAmount,
        message: "Expense amount cannot be negative.",
      },
    },
    expenseDate: Date,
    paymentMethod: {
      type: String,
      enum: {
        values: EXPENSE_PAYMENT_METHODS,
        message: "Expense payment method is invalid.",
      },
    },
    vendorName: {
      type: String,
      trim: true,
      maxlength: [200, "Vendor name cannot exceed 200 characters."],
    },
    receiptReference: {
      type: String,
      trim: true,
      maxlength: [200, "Receipt reference cannot exceed 200 characters."],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [2000, "Expense notes cannot exceed 2,000 characters."],
    },
  },
  createModelOptions("expenses")
);

expenseSchema.index({ expenseDate: -1, createdAt: -1, _id: 1 });

const Expense = models.Expense || model("Expense", expenseSchema);

export { expenseSchema };
export default Expense;
