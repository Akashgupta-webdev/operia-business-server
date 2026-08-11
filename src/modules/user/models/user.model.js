import mongoose from "mongoose";
import { createHash } from "node:crypto";

const { Schema, model, models } = mongoose;

export const USER_ROLES = Object.freeze(["ADMIN", "AGENT"]);
export const USER_STATUSES = Object.freeze(["ACTIVE", "INACTIVE"]);

export const hashAccessKey = (accessKey) => {
  if (typeof accessKey !== "string") {
    return accessKey;
  }

  return createHash("sha256").update(accessKey).digest("hex");
};

const setAccessKey = function (accessKey) {
  if (this instanceof mongoose.Query) {
    return accessKey;
  }

  return hashAccessKey(accessKey);
};

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: [true, "User name is required."],
      trim: true,
      minlength: [2, "User name must contain at least 2 characters."],
      maxlength: [120, "User name cannot exceed 120 characters."],
    },
    email: {
      type: String,
      required: [true, "User email is required."],
      trim: true,
      lowercase: true,
      maxlength: [254, "User email cannot exceed 254 characters."],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "User email must be valid."],
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "User role must be ADMIN or AGENT.",
      },
      default: "AGENT",
      required: true,
    },
    status: {
      type: String,
      enum: {
        values: USER_STATUSES,
        message: "User status must be ACTIVE or INACTIVE.",
      },
      default: "ACTIVE",
      required: true,
    },
    accessKey: {
      type: String,
      required: [true, "An access key is required."],
      select: false,
      set: setAccessKey,
    },
    refreshKeyHash: {
      type: String,
      select: false,
    },
  },
  {
    collection: "users",
    optimisticConcurrency: true,
    timestamps: true,
    versionKey: "version",
    toJSON: {
      transform(_document, value) {
        value.id = value._id.toString();
        delete value._id;
        delete value.accessKey;
        delete value.refreshKeyHash;
        return value;
      },
    },
    toObject: {
      transform(_document, value) {
        delete value.accessKey;
        delete value.refreshKeyHash;
        return value;
      },
    },
  }
);

userSchema.index({ email: 1 }, { unique: true });

const User = models.User || model("User", userSchema);

export { userSchema };
export default User;
