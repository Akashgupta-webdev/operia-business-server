import mongoose from "mongoose";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

import { clientVatSchema } from "./clientVat.schema.js";

const { Schema, model, models } = mongoose;

export const CLIENT_SERVICE_CATEGORIES = Object.freeze([
  "Business Setup",
  "Visa & Immigration",
  "Tax & Accounting",
  "PRO Services",
  "Legal & Advisory",
]);

export const CLIENT_SERVICE_PACKAGES = Object.freeze([
  "Mainland LLC Company Formation Package",
  "Freezone Company Formation Package",
  "Offshore Company Setup Package",
  "Trade Licence Renewal Package",
  "Trade Licence Amendment / Partner Change",
  "Instant / Freelance License Setup",
  "Bank Account Opening Assistance Package",
  "Branch Office / Foreign Entity Setup",
  "Custom Business Setup Service",
  "Investor / Partner 2-Year Visa Package",
  "Employment Visa (Normal / Skilled) Package",
  "Golden Visa (10-Year Residency) Package",
  "Family / Dependent Visa Package",
  "Domestic Worker / Maid Visa Package",
  "Visa Cancellation / Change of Status Package",
  "Emirates ID & VIP Medical Assistance",
  "Tourist / Visit Visa Extension Package",
  "Custom Visa & Immigration Service",
  "Corporate Tax Registration Package",
  "Annual Corporate Tax Return Filing",
  "VAT Registration Package",
  "VAT Deregistration Package",
  "Quarterly VAT Return Filing Package",
  "Monthly Bookkeeping & Accounting Package",
  "Financial Audit & Balance Sheet Assistance",
  "Tax Assessment & Advisory Consultation",
  "Custom Tax & Accounting Service",
  "Establishment Card (New / Renewal) Package",
  "MOHRE / Labour File & Quota Processing",
  "Signature Card Issuance & E-Sign Activation",
  "Municipality / Civil Defence / External Approvals",
  "Legal Translation & Notarization Package",
  "Customs Code (New / Renewal) Package",
  "Tenancy Contract / Ejari Registration Assistance",
  "Commercial Vehicle / Fleet Approval Assistance",
  "Custom PRO Service",
  "MOA & Shareholder Agreement Drafting / Amendment",
  "Power of Attorney (POA) & Board Resolution",
  "Trademark Registration & Brand Protection",
  "Company Liquidation / Deregistration Package",
  "Commercial Contract Review & Legal Advisory",
  "UBO & ESR (Economic Substance) Compliance Filing",
  "Share Transfer / Capital Increase Agreement",
  "Custom Legal & Advisory Service",
]);

export const CLIENT_SERVICE_STATUSES = Object.freeze([
  "In Progress",
  "Pending",
  "Completed",
  "Cancelled",
]);

export const CLIENT_SERVICE_PAYMENT_STATUSES = Object.freeze([
  "Unpaid",
  "Partial",
  "Paid",
]);

const clientServiceSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    company: { type: Schema.Types.ObjectId, ref: "ClientCompany" },
    serviceCode: { type: String, enum: ["VAT_RETURN_FILING"] },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
    dueDate: Date,
    previousService: { type: Schema.Types.ObjectId, ref: "ClientService" },
    details: { type: new Schema({ vat: clientVatSchema }, { _id: false, strict: "throw" }), default: undefined },
    category: {
      type: String,
      enum: {
        values: CLIENT_SERVICE_CATEGORIES,
        message: "Client service category is invalid.",
      },
    },
    package: {
      type: String,
      enum: {
        values: CLIENT_SERVICE_PACKAGES,
        message: "Client service package is invalid.",
      },
    },
    status: {
      type: String,
      enum: {
        values: CLIENT_SERVICE_STATUSES,
        message: "Client service status is invalid.",
      },
    },
    packagePrice: Schema.Types.Decimal128,
    paymentStatus: {
      type: String,
      enum: {
        values: CLIENT_SERVICE_PAYMENT_STATUSES,
        message: "Client service payment status is invalid.",
      },
    },
    targetCompletionDate: formattedDateField("Target completion date"),
    notes: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: undefined,
    },
  },
  createModelOptions("clientServices")
);

// Rejects incomplete VAT records even when created outside the HTTP validators.
// Legacy services remain valid without any VAT fields or workflow state.
clientServiceSchema.pre("validate", function validateVatServiceRecord() {
  if (this.serviceCode !== "VAT_RETURN_FILING") return;
  for (const field of ["company", "dueDate", "details.vat"]) {
    if (!this.get(field)) this.invalidate(field, "VAT filing requires this field.");
  }
  if (this.category !== "Tax & Accounting" || this.package !== "Quarterly VAT Return Filing Package") {
    this.invalidate("package", "VAT filing requires the VAT tax category and package.");
  }
  const vat = this.details?.vat;
  if (vat && !(vat.periodStart <= vat.periodEnd && vat.periodEnd < this.dueDate)) {
    this.invalidate("dueDate", "VAT deadline must follow a valid period.");
  }
  if (vat?.stage === "FILED" && (!vat.submission?.reference || !vat.submission?.acknowledgment || !vat.approval || this.status !== "Completed")) {
    this.invalidate("details.vat.submission", "Filed returns require approval, evidence and Completed status.");
  }
});

clientServiceSchema.index({ client: 1, createdAt: -1, _id: 1 });

clientServiceSchema.index({ "details.vat.trn": 1, "details.vat.periodStart": 1, "details.vat.periodEnd": 1 }, { unique: true, partialFilterExpression: { serviceCode: "VAT_RETURN_FILING" }, name: "unique_vat_period" });
clientServiceSchema.index({ previousService: 1 }, { unique: true, partialFilterExpression: { previousService: { $type: "objectId" } }, name: "unique_vat_successor" });
clientServiceSchema.index({ serviceCode: 1, status: 1, dueDate: 1, _id: 1 });

const ClientService =
  models.ClientService || model("ClientService", clientServiceSchema);

export { clientServiceSchema };
export default ClientService;
