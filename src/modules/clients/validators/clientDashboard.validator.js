import Joi from "joi";

import { DATE_FORMAT_PATTERN } from "../../common/models/model.schema.js";
import { ClientDashboardKPIValidationError } from "../errors/clientDashboard.error.js";

export const CLIENT_DASHBOARD_TYPES = Object.freeze([
  "Clients",
  "Companies",
  "Renewals",
  "High Priority",
]);

// Rejects impossible calendar dates after the shared dd-mm-yyyy shape check succeeds.
// UTC component comparison avoids locale and daylight-saving differences during validation.
const validateCalendarDate = (value, helpers) => {
  const [day, month, year] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return helpers.error("date.format");
  }

  return value;
};

const dashboardDateSchema = Joi.string()
  .trim()
  .pattern(DATE_FORMAT_PATTERN, { name: "dd-mm-yyyy" })
  .custom(validateCalendarDate, "calendar date validation")
  .messages({ "date.format": "{{#label}} must contain a valid calendar date" });

export const getClientDashboardKPIQuerySchema = Joi.object({
  type: Joi.string().valid(...CLIENT_DASHBOARD_TYPES),
  fromDate: dashboardDateSchema.allow(null).default(null),
  toDate: dashboardDateSchema.allow(null).default(null),
})
  .custom((value, helpers) => {
    if (!value.fromDate || !value.toDate) {
      return value;
    }

    const toSortableDate = (date) => {
      const [day, month, year] = date.split("-");
      return `${year}-${month}-${day}`;
    };

    if (toSortableDate(value.fromDate) > toSortableDate(value.toDate)) {
      return helpers.error("date.range");
    }

    return value;
  }, "dashboard date range validation")
  .messages({
    "date.range": "\"fromDate\" must be earlier than or equal to \"toDate\"",
  })
  .required()
  .unknown(false);

// Validates dashboard scope and inclusive expiry-date filters before database aggregation.
// Missing date filters are normalized to null so the service receives a stable query shape.
export const validateGetClientDashboardKPI = (req, _res, next) => {
  const { error, value } = getClientDashboardKPIQuerySchema.validate(
    req.query,
    {
      abortEarly: false,
      stripUnknown: false,
    }
  );

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join(".") || "query",
      issue: detail.message,
    }));
    return next(new ClientDashboardKPIValidationError(details));
  }

  req.validatedQuery = value;
  return next();
};
