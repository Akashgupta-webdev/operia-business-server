import mongoose from "mongoose";

const { Schema, model, models } = mongoose;

const nonNegativeAmount = (label) => ({
  type: Schema.Types.Decimal128,
  required: [true, `${label} is required.`],
  validate: {
    validator: (value) => !value || !value.toString().startsWith("-"),
    message: `${label} cannot be negative.`,
  },
});

const paymentSchema = new Schema(
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
    governmentFee: nonNegativeAmount("Government fee"),
    serviceFee: nonNegativeAmount("Service fee"),
    totalAmount: nonNegativeAmount("Total amount"),
    amountReceived: nonNegativeAmount("Amount received"),
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required."],
      trim: true,
      uppercase: true,
      minlength: [1, "Payment method cannot be empty."],
      maxlength: [50, "Payment method cannot exceed 50 characters."],
    },
    paymentDate: {
      type: Date,
      required: [true, "Payment date is required."],
    },
    paymentStatus: {
      type: String,
      required: [true, "Payment status is required."],
      trim: true,
      uppercase: true,
      minlength: [1, "Payment status cannot be empty."],
      maxlength: [50, "Payment status cannot exceed 50 characters."],
    },
  },
  {
    collection: "payments",
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

paymentSchema.index({ company: 1, service: 1, paymentDate: -1, _id: 1 });

const Payment = models.Payment || model("Payment", paymentSchema);

export { paymentSchema };
export default Payment;
