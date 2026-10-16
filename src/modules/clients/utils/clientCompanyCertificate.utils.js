import { parseVatDate } from "./clientVat.utils.js";

// Permits numeric and authority-prefixed document references without assuming a UAE-wide checksum.
// This application format policy accepts letters, digits, spaces, dots, slashes and hyphens.
export const COMPANY_CERTIFICATE_NUMBER_PATTERN = /^(?=.*[0-9])[A-Za-z0-9]+(?:[ ./-][A-Za-z0-9]+)*$/;

// Validates nullable company certificate expiry dates using the existing real-calendar parser.
// Keeping the stored dd-mm-yyyy string preserves compatibility with the renewals aggregation.
export function isValidCompanyCertificateExpiry(value) {
  if (value == null) return true;
  try {
    parseVatDate(value);
    return true;
  } catch {
    return false;
  }
}
