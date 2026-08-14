import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const SERVICE_CATEGORIES = Object.freeze([
  "TRADE_LICENCE_NEW_RENEWAL_AMENDMENT",
  "VAT_REGISTRATION",
  "VAT_DEREGISTRATION",
  "CORPORATE_TAX_REGISTRATION",
  "ESTABLISHMENT_CARD_NEW_RENEWAL",
  "SIGNATURE_CARD_NEW_RENEWAL",
  "SIGNATURE_CARD_ACTIVATION",
  "BANK_ACCOUNT_ASSISTANCE",
  "VAT_FILING_QUARTERLY_MONTHLY",
  "VAT_PAYMENT_TRACKING",
  "CORPORATE_TAX_FILING_ANNUAL",
  "CORPORATE_TAX_PAYMENT_TRACKING",
  "INVESTOR_PARTNER_EMPLOYEE_VISA_NEW",
  "VISA_RENEWAL",
  "VISA_CANCELLATION",
  "STATUS_CHANGE",
  "MEDICAL_TEST",
  "EMIRATES_ID",
  "HEALTH_INSURANCE",
  "ILOE_INSURANCE",
  "BENEFICIARY_UPDATE",
  "TYPING_SERVICES",
  "IMMIGRATION_LABOUR_SERVICES",
  "OTHER_CUSTOM_SERVICE",
]);

export const SERVICE_STATUSES = Object.freeze([
  "NOT_STARTED",
  "IN_PROGRESS",
  "SUBMITTED",
  "COMPLETE",
]);

const serviceSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    category: {
      type: String,
      enum: {
        values: SERVICE_CATEGORIES,
        message: "Service category is invalid.",
      },
      required: [true, "Service category is required."],
    },
    status: {
      type: String,
      enum: {
        values: SERVICE_STATUSES,
        message:
          "Service status must be NOT_STARTED, IN_PROGRESS, SUBMITTED, or COMPLETE.",
      },
      default: "NOT_STARTED",
      required: [true, "Service status is required."],
    },
    detail: {
      type: Map,
      of: Schema.Types.Mixed,
      required: [true, "Service detail is required."],
      validate: {
        validator: (value) => value instanceof Map && value.size > 0,
        message: "Service detail must contain at least one field.",
      },
    },
  },
  {
    collection: "services",
    optimisticConcurrency: true,
    timestamps: true,
    versionKey: "version",
    toJSON: {
      transform(_document, value) {
        value.id = value._id.toString();
        delete value._id;
        return value;
      },
    },
  }
);

serviceSchema.index({ client: 1, company: 1, status: 1, createdAt: -1, _id: 1 });

const Service = models.Service || model("Service", serviceSchema);

export { serviceSchema };
export default Service;
