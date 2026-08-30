export const DATE_FORMAT_PATTERN =
  /^(0[1-9]|[12]\d|3[01])-(0[1-9]|1[0-2])-\d{4}$/;

export const formattedDateField = (label) => ({
  type: String,
  trim: true,
  match: [DATE_FORMAT_PATTERN, `${label} must use the dd-mm-yyyy format.`],
});

export const createModelOptions = (collection, privateFields = []) => ({
  collection,
  optimisticConcurrency: true,
  timestamps: true,
  versionKey: "version",
  toJSON: {
    transform(_document, value) {
      value.id = value._id.toString();
      delete value._id;
      for (const field of privateFields) {
        delete value[field];
      }
      return value;
    },
  },
});
