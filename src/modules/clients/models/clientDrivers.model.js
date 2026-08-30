import mongoose from "mongoose";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

const clientDriverSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    name: {
      type: String,
      trim: true,
    },
    licenceIssueDate: formattedDateField("Licence issue date"),
    licenceExpiryDate: formattedDateField("Licence expiry date"),
  },
  createModelOptions("clientDrivers")
);

clientDriverSchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientDriver =
  models.ClientDriver || model("ClientDriver", clientDriverSchema);

export { clientDriverSchema };
export default ClientDriver;
