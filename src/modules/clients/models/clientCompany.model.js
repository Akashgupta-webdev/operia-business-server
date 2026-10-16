import mongoose from "mongoose";
import { COMPANY_CERTIFICATE_NUMBER_PATTERN, isValidCompanyCertificateExpiry } from "../utils/clientCompanyCertificate.utils.js";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

const certificateNumberField = {
  type: String, trim: true, maxlength: 100,
  validate: {
    // Checks document references while permitting explicit clearing of optional fields.
    // Uses the same format policy as the Company update request validator.
    validator: function validateCompanyCertificateNumber(value) {
      return value == null || COMPANY_CERTIFICATE_NUMBER_PATTERN.test(value);
    },
    message: "Document number must contain a digit and only letters, digits, spaces, dots, slashes or hyphens.",
  },
};
const certificateExpiryField = {
  ...formattedDateField("Certificate expiry"),
  trim: true,
  validate: { validator: isValidCompanyCertificateExpiry, message: "Expiry must be a real dd-mm-yyyy date, year 1900 or later." },
};

const clientCompanySchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    companyName: {
      type: String,
      trim: true,
      required: [true, "Company name is required."],
    },
    tradeLicence: {
      tradeLicenceNo: {
        type: String,
        trim: true,
      },
      tradeLicenceExpiry: formattedDateField("Trade licence expiry"),
    },
    establishment: {
      establishmentCard: {
        type: String,
        trim: true,
      },
      establishmentCardExpiry: formattedDateField("Establishment card expiry"),
    },
    vatTaxRegistrationNumber: {
      type: String,
      trim: true,
    },
    civilDefenceCertificate: {
      certificationNo: certificateNumberField,
      expiryDate: certificateExpiryField,
    },
    commercialTradeLicence: {
      licenceNo: certificateNumberField,
      expiryDate: certificateExpiryField,
    },
    corporateTaxNumber: {
      type: String,
      trim: true,
    },
    complianceDueDate: {
      nextVATDue: { type: Date },
      nextTAXDue: { type: Date },
    },
  },
  createModelOptions("clientCompanies")
);

clientCompanySchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientCompany =
  models.ClientCompany || model("ClientCompany", clientCompanySchema);

export { clientCompanySchema };
export default ClientCompany;
