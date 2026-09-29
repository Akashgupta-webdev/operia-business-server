import mongoose from "mongoose";
import { VAT_STAGES } from "../utils/clientVat.utils.js";

const { Schema } = mongoose;
const ref = { type: Schema.Types.ObjectId, ref: "ClientDocument" };
const options = { _id: false, strict: "throw" };
const approvalSchema = new Schema({ name: String, document: ref, revision: Number, recordedBy: String, recordedAt: Date }, options);
const calculationSchema = new Schema({
  outputVat: Schema.Types.Decimal128,
  recoverableInputVat: Schema.Types.Decimal128,
  netVat: Schema.Types.Decimal128,
  workingPaper: ref,
  sourceDocuments: [ref],
}, options);
const eventSchema = new Schema({
  action: String, actor: String, at: Date, revision: Number, reason: String,
  reference: String, document: ref, amount: Schema.Types.Decimal128,
  calculation: calculationSchema, approval: approvalSchema,
  periodStart: Date, periodEnd: Date, dueDate: Date, scheduledFor: Date, notes: [String], assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
}, options);

export const clientVatSchema = new Schema({
  trn: { type: String, required: true, match: /^\d{15}$/ },
  country: { type: String, enum: ["AE"], default: "AE" },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  stage: { type: String, enum: VAT_STAGES, default: "AWAITING_DOCUMENTS" },
  revision: { type: Number, default: 0 },
  calculation: calculationSchema,
  review: new Schema({ actor: String, at: Date, revision: Number }, options),
  approval: approvalSchema,
  submission: new Schema({ reference: String, submittedOn: Date, acknowledgment: ref, recordedBy: String, recordedAt: Date }, options),
  settlement: new Schema({
    status: { type: String, enum: ["UNPAID", "PARTIAL", "PAID", "NOT_DUE", "CREDIT"] },
    amountPaid: Schema.Types.Decimal128, paidOn: Date, document: ref,
  }, options),
  history: { type: [eventSchema], default: [] },
}, options);
