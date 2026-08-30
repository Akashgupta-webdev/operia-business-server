import mongoose from "mongoose";

import { createModelOptions } from "../../common/models/model.schema.js";
import {
  emiratesSchema,
  healthInsuranceSchema,
  passportSchema,
  visaSchema,
} from "./client-details.schema.js";

const { Schema, model, models } = mongoose;

export const NATIONALITIES = Object.freeze([
  "United Arab Emirates",
  "India",
  "Pakistan",
  "Philippines",
  "Egypt",
  "United Kingdom",
  "Germany",
]);

export const CLIENT_TYPES = Object.freeze(["INDIVIDUAL", "COMPANY"]);
export const PREFERRED_COMMUNICATION_METHODS = Object.freeze([
  "Email",
  "Whatsapp",
  "Call",
]);
export const CLIENT_STATUSES = Object.freeze([
  "Active",
  "Inactive",
  "Archived",
  "Draft",
]);

const clientSchema = new Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    mobileNumber: {
      type: String,
      trim: true,
    },
    whatsappNumber: {
      type: String,
      trim: true,
    },
    emailAddress: {
      type: String,
      trim: true,
      lowercase: true,
    },
    nationality: {
      type: String,
      enum: {
        values: NATIONALITIES,
        message: "Nationality is invalid.",
      },
    },
    clientType: {
      type: String,
      enum: CLIENT_TYPES,
      default: "INDIVIDUAL",
    },
    status: {
      type: String,
      enum: CLIENT_STATUSES,
      default: "Active",
    },
    preferredCommunicationMethod: {
      type: String,
      enum: PREFERRED_COMMUNICATION_METHODS,
      default: "Call",
    },
    passport: passportSchema,
    emirates: emiratesSchema,
    visa: visaSchema,
    healthInsurance: healthInsuranceSchema,
  },
  createModelOptions("clients")
);

const Client = models.Client || model("Client", clientSchema);

export { clientSchema };
export default Client;
