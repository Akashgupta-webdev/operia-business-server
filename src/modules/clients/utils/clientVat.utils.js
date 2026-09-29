import { ClientVatError } from "../errors/clientVat.error.js";

export const VAT_SERVICE_CODE = "VAT_RETURN_FILING";
export const VAT_PACKAGE = "Quarterly VAT Return Filing Package";
export const VAT_STAGES = ["AWAITING_DOCUMENTS", "PREPARING", "INTERNAL_REVIEW", "AWAITING_CLIENT_APPROVAL", "READY_TO_FILE", "FILED"];
export const VAT_DOCUMENT_PURPOSES = ["SOURCE", "WORKING_PAPER", "APPROVAL", "ACKNOWLEDGMENT", "TAX_PAYMENT"];

// Parses real Client API calendar dates without accepting JavaScript date rollover.
// Midnight UTC represents a date only; deadlines are compared using Dubai's day.
export const parseVatDate = (value) => {
  if (typeof value !== "string" || !/^\d{2}-\d{2}-\d{4}$/.test(value)) throw new ClientVatError("VALIDATION_FAILED", "Use a real dd-mm-yyyy date.");
  const [day, month, year] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new ClientVatError("VALIDATION_FAILED", "Use a real dd-mm-yyyy date, year 1900 or later.");
  return date;
};

// Validates the period and statutory deadline as one coherent obligation.
// The supplied deadline is authoritative; no calendar-quarter deadline is inferred.
export const validateVatPeriod = (periodStart, periodEnd, dueDate) => {
  if (!(periodStart <= periodEnd && periodEnd < dueDate)) throw new ClientVatError("VALIDATION_FAILED", "Period start must not follow its end; the deadline must follow the period.");
};

// Converts bounded decimal strings to exact minor units for financial comparisons.
// Avoids binary floating-point rounding in both totals and payment settlement.
export const vatMinorUnits = (value) => {
  const text = String(value);
  if (!/^-?\d{1,16}(?:\.\d{1,2})?$/.test(text)) throw new ClientVatError("VALIDATION_FAILED", "Invalid VAT amount.");
  const negative = text.startsWith("-");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"))) * (negative ? -1n : 1n);
};

// Formats exact minor units for Decimal128 persistence and JSON decimal strings.
// This also preserves negative credit positions without using Number arithmetic.
export const formatVatAmount = (minor) => `${minor < 0n ? "-" : ""}${(minor < 0n ? -minor : minor) / 100n}.${String((minor < 0n ? -minor : minor) % 100n).padStart(2, "0")}`;

// Returns the current UAE calendar day as the date-only storage representation.
// UTC+4 has no daylight-saving transitions; the clock is injectable in tests.
export const vatToday = (now = new Date()) => {
  const dubai = new Date(now.getTime() + 4 * 60 * 60 * 1000);
  return new Date(Date.UTC(dubai.getUTCFullYear(), dubai.getUTCMonth(), dubai.getUTCDate()));
};

// Requires the browser's expected version before executing a VAT command.
// Mongoose optimistic concurrency separately catches concurrent writes after load.
export const assertVatVersion = (record, expectedVersion) => {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== record.version) throw new ClientVatError("VERSION_CONFLICT", "The service changed or expectedVersion is missing. Reload before retrying.", 409);
};
