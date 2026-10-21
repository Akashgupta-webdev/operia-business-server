import mongoose from "mongoose";
import { createModelOptions } from "../../common/models/model.schema.js";
import { calculateInvoiceTotals, isValidInvoiceAmount, UAE_EMIRATES, UAE_CONTACT_PATTERN } from "../utils/clientInvoice.utils.js";
import { prepareInvoiceForSave } from "../services/clientInvoicePersistence.service.js";

const { Schema, model, models } = mongoose;
export const CLIENT_INVOICE_TYPES = Object.freeze(["Operio To Client", "Client To Customer"]);
export const CLIENT_INVOICE_TAX_CODES = Object.freeze([0, 5]);
const amountField = {
  type: Schema.Types.Decimal128, required: true,
  validate: { validator: isValidInvoiceAmount, message: "Amount must be non-negative with at most two decimal places." },
};
const clientInvoiceItemSchema = new Schema({
  itemDescription: { type: String, trim: true, required: true },
  qty: { type: Number, required: true, validate: {
    // Allows fractional quantities while rejecting zero and non-finite values.
    // Line monetary totals remain explicitly supplied invoice facts.
    validator: function isPositiveQuantity(value) { return Number.isFinite(value) && value > 0; },
    message: "Quantity must be greater than zero.",
  } },
  govtRate: amountField,
  servicePrice: amountField,
  taxCode: { type: Number, enum: CLIENT_INVOICE_TAX_CODES, required: true },
  taxAmount: amountField,
  grandTotal: amountField,
}, { _id: false, strict: "throw" });

const clientInvoiceSchema = new Schema({
  clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true, immutable: true },
  companyId: { type: Schema.Types.ObjectId, ref: "ClientCompany", required: true },
  invoiceType: { type: String, enum: CLIENT_INVOICE_TYPES, default: "Operio To Client", required: true },
  customerName: { type: String, trim: true },
  emirate: { type: String, enum: UAE_EMIRATES },
  contactNo: { type: String, trim: true, match: [UAE_CONTACT_PATTERN, "Use a valid UAE mobile or landline number."] },
  fullAddress: { type: String, trim: true },
  trnNo: { type: String, trim: true },
  emailAddress: { type: String, trim: true },
  issueDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date },
  service: { type: [clientInvoiceItemSchema], required: true, default: undefined, validate: {
    // Requires billable service lines on document and query writes.
    // Blank display rows are not persisted as invoice services.
    validator: function hasServices(value) { return Array.isArray(value) && value.length > 0; },
    message: "Invoice must contain at least one service.",
  } },
  grandTotalTaxAmount: { ...amountField, default: "0.00" },
  grandTotalAmount: { ...amountField, default: "0.00" },
  invoiceNo: { type: String, trim: true, immutable: true },
  accountNo: { type: String, trim: true },
  switftBIC: { type: String, trim: true },
  iban: { type: String, trim: true },
}, { ...createModelOptions("clientInvoices"), strict: "throw" });

// Recalculates stored totals before validation and persistence.
// Invalid monetary inputs become validation errors rather than rounded amounts.
function refreshInvoiceTotals() {
  try { Object.assign(this, calculateInvoiceTotals(this.service)); }
  catch (error) { this.invalidate("service", error.message); }
}
clientInvoiceSchema.pre("validate", refreshInvoiceTotals);
clientInvoiceSchema.pre("save", prepareInvoiceForSave);

// Supports atomic whole-service replacements without reading stale totals.
// Partial edits and reference changes use document save through the invoice service.
clientInvoiceSchema.pre(["updateOne", "updateMany", "findOneAndUpdate"], function prepareInvoiceUpdate() {
  const update = this.getUpdate();
  if (Array.isArray(update) || this.getOptions().upsert) throw new Error("Use invoice save for pipelines or upserts.");
  for (const [operator, values] of Object.entries(update ?? {})) {
    for (const key of operator.startsWith("$") ? Object.keys(values) : [operator]) {
      if (["clientId", "companyId", "trnNo", "invoiceNo", "grandTotalTaxAmount", "grandTotalAmount"].some((field) => key === field || key.startsWith(field + "."))
        || key.startsWith("service.") || (key === "service" && operator !== "$set" && operator !== "service")
        || operator === "$rename") {
        throw new Error("Use invoice save for reference, generated-field or partial service changes.");
      }
    }
  }
  const lines = update?.$set?.service ?? update?.service;
  if (lines !== undefined) update.$set = { ...update.$set, ...calculateInvoiceTotals(lines) };
  this.setOptions({ runValidators: true });
});

// Prevents bulk and replacement writes from bypassing document invariants.
// Use the invoice service for validated and versioned writes.
clientInvoiceSchema.pre(["replaceOne", "findOneAndReplace", "insertMany", "bulkWrite"], function rejectUnsafeInvoiceWrite() {
  throw new Error("Use invoice document save for this operation.");
});
clientInvoiceSchema.index({ invoiceNo: 1 }, { unique: true });
clientInvoiceSchema.index({ clientId: 1, issueDate: -1, _id: 1 });
const ClientInvoice = models.ClientInvoice || model("ClientInvoice", clientInvoiceSchema);
export { clientInvoiceSchema, clientInvoiceItemSchema };
export default ClientInvoice;
