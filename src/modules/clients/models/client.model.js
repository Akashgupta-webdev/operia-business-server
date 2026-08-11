import { randomUUID } from "node:crypto";

import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

export const CLIENT_TYPES = Object.freeze(["INDIVIDUAL", "COMPANY"]);
export const PREFERRED_COMMUNICATION_METHODS = Object.freeze([
  "EMAIL",
  "WHATSAPP",
  "CALL",
]);
export const CLIENT_STATUSES = Object.freeze([
  "ACTIVE",
  "INACTIVE",
  "PROSPECT",
  "ARCHIVED",
]);

const clientSchema = new Schema(
  {
    clientId: {
      type: String,
      default: randomUUID,
      immutable: true,
      required: true,
    },
    clientType: {
      type: String,
      enum: {
        values: CLIENT_TYPES,
        message: "Client type must be INDIVIDUAL or COMPANY.",
      },
      default: "INDIVIDUAL",
      required: [true, "Client type is required."],
    },
    name: {
      type: String,
      required: [true, "Client name is required."],
      trim: true,
      minlength: [2, "Client name must contain at least 2 characters."],
      maxlength: [200, "Client name cannot exceed 200 characters."],
    },
    mobileNumber: {
      type: String,
      trim: true,
      maxlength: [30, "Mobile number cannot exceed 30 characters."],
    },
    whatsappNumber: {
      type: String,
      trim: true,
      maxlength: [30, "WhatsApp number cannot exceed 30 characters."],
    },
    emailAddress: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [254, "Email address cannot exceed 254 characters."],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email address must be valid."],
    },
    nationality: {
      type: String,
      trim: true,
      maxlength: [120, "Nationality cannot exceed 120 characters."],
    },
    emiratesIdNumber: {
      type: String,
      trim: true,
      maxlength: [30, "Emirates ID number cannot exceed 30 characters."],
    },
    passportNumber: {
      type: String,
      trim: true,
      maxlength: [30, "Passport number cannot exceed 30 characters."],
    },
    address: {
      type: String,
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters."],
    },
    preferredCommunicationMethod: {
      type: String,
      enum: {
        values: PREFERRED_COMMUNICATION_METHODS,
        message:
          "Preferred communication method must be EMAIL, WHATSAPP, or CALL.",
      },
      required: [true, "Preferred communication method is required."],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [5000, "Notes cannot exceed 5000 characters."],
    },
    clientStatus: {
      type: String,
      enum: {
        values: CLIENT_STATUSES,
        message:
          "Client status must be ACTIVE, INACTIVE, PROSPECT, or ARCHIVED.",
      },
      default: "ACTIVE",
      required: true,
    },
  },
  {
    collection: "clients",
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

clientSchema.pre("validate", function validateContactDetails() {
  if (!this.mobileNumber && !this.whatsappNumber && !this.emailAddress) {
    this.invalidate(
      "mobileNumber",
      "At least one mobile number, WhatsApp number, or email address is required."
    );
  }
});

clientSchema.index({ clientId: 1 }, { unique: true });

const Client = models.Client || model("Client", clientSchema);

export { clientSchema };
export default Client;
