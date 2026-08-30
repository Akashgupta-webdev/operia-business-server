import mongoose from "mongoose";

import { createModelOptions } from "../../common/models/model.schema.js";
import {
  emiratesSchema,
  healthInsuranceSchema,
  passportSchema,
  visaSchema,
} from "./client-details.schema.js";

const { Schema, model, models } = mongoose;

export const CLIENT_MEMBER_TYPES = Object.freeze([
  "Partner",
  "Employee/Staff",
  "Manger",
  "Director",
  "Other",
]);

const clientMemberSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    memberType: {
      type: String,
      enum: {
        values: CLIENT_MEMBER_TYPES,
        message: "Client member type is invalid.",
      },
    },
    name: {
      type: String,
      trim: true,
    },
    passport: passportSchema,
    emirates: emiratesSchema,
    visa: visaSchema,
    healthInsurance: healthInsuranceSchema,
  },
  createModelOptions("clientMembers")
);

clientMemberSchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientMember =
  models.ClientMember || model("ClientMember", clientMemberSchema);

export { clientMemberSchema };
export default ClientMember;
