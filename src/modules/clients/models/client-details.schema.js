import mongoose from "mongoose";

import { formattedDateField } from "../../common/models/model.schema.js";

const { Schema } = mongoose;

export const passportSchema = new Schema(
  {
    passportNumber: {
      type: String,
      trim: true,
      uppercase: true,
      match: [
        /^[A-Z]\d{7}$/,
        "Passport number must contain one letter followed by seven digits.",
      ],
    },
    passportIssueDate: formattedDateField("Passport issue date"),
    passportExpiryDate: formattedDateField("Passport expiry date"),
  },
  { _id: false }
);

export const emiratesSchema = new Schema(
  {
    emiratesId: {
      type: String,
      trim: true,
      match: [
        /^784-\d{4}-\d{7}-\d$/,
        "Emirates ID must use the 784-YYYY-XXXXXXX-X format.",
      ],
    },
    emiratesIssueDate: formattedDateField("Emirates issue date"),
    emiratesExpiryDate: formattedDateField("Emirates expiry date"),
  },
  { _id: false }
);

export const visaSchema = new Schema(
  {
    visaUIDNumber: {
      type: String,
      trim: true,
      match: [/^\d{9,15}$/, "Visa UID number must contain 9 to 15 digits."],
    },
    visaIssueDate: formattedDateField("Visa issue date"),
    visaExpiryDate: formattedDateField("Visa expiry date"),
  },
  { _id: false }
);

export const healthInsuranceSchema = new Schema(
  {
    healthInsuranceCardNumber: {
      type: String,
      trim: true,
    },
    healthInsuranceIssueDate: formattedDateField(
      "Health insurance issue date"
    ),
    healthInsuranceExpiryDate: formattedDateField(
      "Health insurance expiry date"
    ),
  },
  { _id: false }
);
