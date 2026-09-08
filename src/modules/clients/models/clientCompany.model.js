import mongoose from "mongoose";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

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
    corporateTaxNumber: {
      type: String,
      trim: true,
    },
  },
  createModelOptions("clientCompanies")
);

clientCompanySchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientCompany =
  models.ClientCompany || model("ClientCompany", clientCompanySchema);

export { clientCompanySchema };
export default ClientCompany;
