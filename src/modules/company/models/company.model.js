import mongoose from "mongoose";

import { createCountId } from "../../common/services/counter.service.js";

const { Schema, model, models } = mongoose;

export const COMPANY_TYPES = Object.freeze([
  "MAINLAND",
  "FREE_ZONE",
  "OFFSHORE",
]);

export const COMPANY_STATUSES = Object.freeze([
  "ACTIVE",
  "UNDER_FORMATION",
  "SUSPENDED",
  "EXPIRED",
  "CLOSED",
]);

export const COMPANY_ID_PREFIX = "comp-";

const licenceSchema = new Schema(
  {
    number: {
      type: String,
      trim: true,
      maxlength: [100, "Licence number cannot exceed 100 characters."],
    },
    activity: {
      type: String,
      trim: true,
      maxlength: [500, "Licence activity cannot exceed 500 characters."],
    },
    issueDate: Date,
    expiryDate: Date,
  },
  { _id: false }
);

const establishmentSchema = new Schema(
  {
    cardNumber: {
      type: String,
      trim: true,
      maxlength: [100, "Establishment card number cannot exceed 100 characters."],
    },
    cardExpiryDate: Date,
  },
  { _id: false }
);

const companySchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    companyId: {
      type: String,
      required: [true, "Company ID is required."],
      immutable: true,
    },
    companyName: {
      type: String,
      required: [true, "Company name is required."],
      trim: true,
      minlength: [2, "Company name must contain at least 2 characters."],
      maxlength: [200, "Company name cannot exceed 200 characters."],
    },
    tradeName: {
      type: String,
      trim: true,
      maxlength: [200, "Trade name cannot exceed 200 characters."],
    },
    legalName: {
      type: String,
      trim: true,
      maxlength: [200, "Legal name cannot exceed 200 characters."],
    },
    companyType: {
      type: String,
      required: [true, "Company type is required."],
      enum: {
        values: COMPANY_TYPES,
        message: "Company type must be MAINLAND, FREE_ZONE, or OFFSHORE.",
      },
    },
    freeZoneName: {
      type: String,
      trim: true,
      maxlength: [200, "Free zone name cannot exceed 200 characters."],
    },
    licence: licenceSchema,
    establishment: establishmentSchema,
    vatTrnNumber: {
      type: String,
      trim: true,
      maxlength: [100, "VAT TRN number cannot exceed 100 characters."],
    },
    corporateTaxRegistrationNumber: {
      type: String,
      trim: true,
      maxlength: [100, "Corporate tax registration number cannot exceed 100 characters."],
    },
    companyEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [254, "Company email cannot exceed 254 characters."],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Company email must be valid."],
    },
    companyMobile: {
      type: String,
      trim: true,
      maxlength: [30, "Company mobile cannot exceed 30 characters."],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Company address cannot exceed 500 characters."],
    },
    bankName: {
      type: String,
      trim: true,
      maxlength: [200, "Bank name cannot exceed 200 characters."],
    },
    accountName: {
      type: String,
      trim: true,
      maxlength: [200, "Account name cannot exceed 200 characters."],
    },
    iban: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: [34, "IBAN cannot exceed 34 characters."],
    },
    accountNumber: {
      type: String,
      trim: true,
      maxlength: [100, "Account number cannot exceed 100 characters."],
    },
    companyStatus: {
      type: String,
      required: true,
      enum: {
        values: COMPANY_STATUSES,
        message:
          "Company status must be ACTIVE, UNDER_FORMATION, SUSPENDED, EXPIRED, or CLOSED.",
      },
      default: "ACTIVE",
    },
    notes: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: [5000, "A company note cannot exceed 5,000 characters."],
        },
      ],
      default: [],
    },
  },
  {
    collection: "companies",
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

companySchema.pre("validate", async function generateCompanyId() {
  if (!this.isNew || this.companyId) {
    return;
  }

  const count = await createCountId("company", this.$session());
  this.companyId = `${COMPANY_ID_PREFIX}${count}`;
});

companySchema.index({ companyId: 1 }, { unique: true });
companySchema.index({ client: 1, createdAt: -1, companyId: 1 });

const Company = models.Company || model("Company", companySchema);

export { companySchema };
export default Company;
