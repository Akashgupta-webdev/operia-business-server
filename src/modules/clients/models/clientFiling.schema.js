import mongoose from "mongoose";
import { createModelOptions } from "../../common/models/model.schema.js";
import { formatVatAmount, parseVatDate, vatMinorUnits } from "../utils/clientVat.utils.js";

export const CLIENT_FILING_STATUSES = Object.freeze(["draft", "pending", "submitted", "paid", "overdue", "rejected"]);

// Validates decimal money using the existing exact, two-decimal financial policy.
// Invalid precision and out-of-range amounts fail schema validation before persistence.
function isValidFilingAmount(value) {
  try {
    vatMinorUnits(value);
    return true;
  } catch {
    return false;
  }
}

// Accepts the existing Client API date format in addition to native Date values.
// Calendar validation for dd-mm-yyyy uses the shared VAT date parser.
function parseFilingDate(value) {
  return typeof value === "string" && /^\d{2}-\d{2}-\d{4}$/.test(value)
    ? parseVatDate(value)
    : value;
}

// Builds separate VAT and TAX schemas with identical filing fields and money rules.
// Payable tax is derived on reads so edits cannot leave a stale stored calculation.
export function createClientFilingSchema(collection) {
  const options = createModelOptions(collection);
  const schema = new mongoose.Schema({
    client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "ClientCompany", required: true },
    input: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: { validator: isValidFilingAmount, message: "Input must be an amount with at most two decimal places." },
    },
    output: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
      validate: { validator: isValidFilingAmount, message: "Output must be an amount with at most two decimal places." },
    },
    filingDate: { type: Date, set: parseFilingDate },
    nextDueDate: { type: Date, required: true, set: parseFilingDate },
    status: { type: String, enum: CLIENT_FILING_STATUSES, default: "pending", required: true },
  }, {
    ...options,
    toJSON: { ...options.toJSON, virtuals: true },
    toObject: { virtuals: true },
  });

  // Computes the requested input-minus-output amount without binary rounding.
  // Returns null for incomplete/invalid unsaved documents rather than hiding validation errors.
  schema.virtual("payableTax").get(function calculatePayableTax() {
    if (this.input == null || this.output == null) return null;
    try {
      return formatVatAmount(vatMinorUnits(this.input) - vatMinorUnits(this.output));
    } catch {
      return null;
    }
  });

  schema.index({ client: 1, filingDate: -1, _id: -1 });
  schema.index({ client: 1, status: 1, nextDueDate: 1 });
  return schema;
}
