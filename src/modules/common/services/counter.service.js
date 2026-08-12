import Counter from "../models/counter.model.js";

const normalizeCounterName = (name) => {
  if (typeof name !== "string") {
    throw new TypeError("Counter name must be a string.");
  }

  const normalizedName = name.trim().toLowerCase();

  if (!normalizedName) {
    throw new TypeError("Counter name cannot be empty.");
  }

  if (normalizedName.length > 100) {
    throw new TypeError("Counter name cannot exceed 100 characters.");
  }

  return normalizedName;
};

export const createCountId = async (name) => {
  const normalizedName = normalizeCounterName(name);
  const counter = await Counter.findOneAndUpdate(
    { name: normalizedName },
    { $inc: { count: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true,
    }
  ).exec();

  return counter.count;
};
