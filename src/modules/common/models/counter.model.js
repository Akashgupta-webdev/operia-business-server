import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const counterSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "Counter name is required."],
      trim: true,
      lowercase: true,
      minlength: [1, "Counter name cannot be empty."],
      maxlength: [100, "Counter name cannot exceed 100 characters."],
      immutable: true,
    },
    count: {
      type: Number,
      required: true,
      default: 1000,
      min: [0, "Counter value cannot be negative."],
      validate: {
        validator: Number.isSafeInteger,
        message: "Counter value must be a safe integer.",
      },
    },
  },
  {
    collection: "counters",
    timestamps: true,
    versionKey: false,
  }
);

counterSchema.index({ name: 1 }, { unique: true });

const Counter = models.Counter || model("Counter", counterSchema);

export { counterSchema };
export default Counter;
