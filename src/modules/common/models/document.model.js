import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const documentSchema = new Schema(
  {
    company: {
      type: Schema.Types.ObjectId,
      ref: "Company",
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: [true, "Service reference is required."],
    },
    documentUrl: {
      type: String,
      required: [true, "Document URL is required."],
      trim: true,
      maxlength: [2048, "Document URL cannot exceed 2,048 characters."],
      match: [/^https?:\/\/\S+$/i, "Document URL must be a valid HTTP or HTTPS URL."],
    },
  },
  {
    collection: "documents",
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

documentSchema.index({ company: 1, service: 1, createdAt: -1, _id: 1 });

const Document = models.Document || model("Document", documentSchema);

export { documentSchema };
export default Document;
