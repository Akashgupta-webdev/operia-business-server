import mongoose from "mongoose";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

export const CLIENT_DOCUMENT_TYPES = Object.freeze([
  "Passport",
  "Emirates ID",
  "Visa",
  "Trade Licence",
  "Other",
]);

const clientDocumentSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    documentTitle: {
      type: String,
      trim: true,
    },
    documentURL: {
      type: String,
      trim: true,
    },
    cloudinaryPublicId: {
      type: String,
      trim: true,
      select: false,
    },
    cloudinaryResourceType: {
      type: String,
      trim: true,
      select: false,
    },
    documentType: {
      type: String,
      enum: {
        values: CLIENT_DOCUMENT_TYPES,
        message: "Client document type is invalid.",
      },
    },
    issueDate: formattedDateField("Document issue date"),
    expiryDate: formattedDateField("Document expiry date"),
  },
  createModelOptions("clientDocuments", [
    "cloudinaryPublicId",
    "cloudinaryResourceType",
  ])
);

clientDocumentSchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientDocument =
  models.ClientDocument || model("ClientDocument", clientDocumentSchema);

export { clientDocumentSchema };
export default ClientDocument;
