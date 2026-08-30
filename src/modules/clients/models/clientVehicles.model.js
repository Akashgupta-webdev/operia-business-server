import mongoose from "mongoose";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

const clientVehicleSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    registrationNumer: {
      type: String,
      trim: true,
    },
    tcNumber: {
      type: String,
      trim: true,
    },
    policyNumber: {
      type: String,
      trim: true,
    },
    registrationExpiry: formattedDateField("Registration expiry date"),
    insuranceExpiry: formattedDateField("Insurance expiry date"),
  },
  createModelOptions("clientVehicles")
);

clientVehicleSchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientVehicle =
  models.ClientVehicle || model("ClientVehicle", clientVehicleSchema);

export { clientVehicleSchema };
export default ClientVehicle;
