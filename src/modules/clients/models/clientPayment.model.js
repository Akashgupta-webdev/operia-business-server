import mongoose from "mongoose";

import { createModelOptions } from "../../common/models/model.schema.js";

const { Schema, model, models } = mongoose;

export const CLIENT_PAYMENT_STATUSES = Object.freeze([
  "Unpaid",
  "Partially Paid",
  "Paid",
  "Credit",
]);
export const CLIENT_PAYMENT_METHODS = Object.freeze([
  "Cash",
  "Bank Transfer",
  "Credit Card",
  "Cheque",
]);

const clientPaymentSchema = new Schema(
  {
    client: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: [true, "Client reference is required."],
    },
    totalBilled: Schema.Types.Decimal128,
    amountReceived: Schema.Types.Decimal128,
    paymentStatus: {
      type: String,
      enum: {
        values: CLIENT_PAYMENT_STATUSES,
        message: "Client payment status is invalid.",
      },
    },
    paymentMethod: {
      type: String,
      enum: {
        values: CLIENT_PAYMENT_METHODS,
        message: "Client payment method is invalid.",
      },
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
  createModelOptions("clientPayments")
);

clientPaymentSchema.index({ client: 1, createdAt: -1, _id: 1 });

const ClientPayment =
  models.ClientPayment || model("ClientPayment", clientPaymentSchema);

export { clientPaymentSchema };
export default ClientPayment;
