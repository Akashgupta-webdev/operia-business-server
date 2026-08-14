import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const reminderSchema = new Schema(
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
    dueDate: {
      type: Date,
      required: [true, "Due date is required."],
    },
    reminderBefore: {
      type: Number,
      required: [true, "Reminder-before days are required."],
      min: [0, "Reminder-before days cannot be negative."],
      validate: {
        validator: Number.isSafeInteger,
        message: "Reminder-before days must be a whole number.",
      },
    },
    followUpsDate: {
      type: Date,
      required: [true, "Follow-up date is required."],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [5000, "Notes cannot exceed 5,000 characters."],
    },
  },
  {
    collection: "reminders",
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

reminderSchema.index({ company: 1, service: 1, dueDate: 1, _id: 1 });

const Reminder = models.Reminder || model("Reminder", reminderSchema);

export { reminderSchema };
export default Reminder;
