import mongoose from "mongoose";

import {
  createModelOptions,
  formattedDateField,
} from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

export const CLIENT_REMINDER_PERIODS = Object.freeze([
  "1 day before",
  "3 day before",
  "7 day before",
  "14 day before",
  "30 before day",
]);
export const CLIENT_REMINDER_PRIORITIES = Object.freeze([
  "Low",
  "Normal",
  "High",
]);

const clientReminderSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    followupDate: formattedDateField("Follow-up date"),
    remindBefore: {
      type: String,
      enum: {
        values: CLIENT_REMINDER_PERIODS,
        message: "Client reminder period is invalid.",
      },
      default: "7 day before",
    },
    priority: {
      type: String,
      enum: {
        values: CLIENT_REMINDER_PRIORITIES,
        message: "Client reminder priority is invalid.",
      },
      default: "Normal",
    },
    notes: {
      type: [
        {
          type: String,
          trim: true,
        },
      ],
      default: undefined,
    },
  },
  createModelOptions("clientReminders")
);

clientReminderSchema.index({ client: 1, followupDate: 1, _id: 1 });

const ClientReminder =
  models.ClientReminder || model("ClientReminder", clientReminderSchema);

export { clientReminderSchema };
export default ClientReminder;
