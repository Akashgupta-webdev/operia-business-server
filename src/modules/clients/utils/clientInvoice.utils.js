import { formatVatAmount, vatMinorUnits } from "./clientVat.utils.js";

export const UAE_EMIRATES = Object.freeze(["Abu Dhabi", "Dubai", "Sharjah", "Ajman", "Umm Al Quwain", "Ras Al Khaimah", "Fujairah"]);
export const UAE_CONTACT_PATTERN = /^(?:0|\+971|00971)(?:5[024568]\d{7}|[234679]\d{7})$/;

// Validates AED amounts using the existing exact minor-unit policy.
// Rejects negative, non-finite and fractional-fils amounts.
export function isValidInvoiceAmount(value) {
  try { return vatMinorUnits(value) >= 0n; } catch { return false; }
}

// Sums supplied line tax and grand totals without floating-point arithmetic.
// Invalid or overflowing monetary values are rejected before persistence.
export function calculateInvoiceTotals(service) {
  if (!Array.isArray(service) || !service.length) throw new Error("Invoice must contain at least one service.");
  let tax = 0n;
  let total = 0n;
  for (const line of service) {
    if (!isValidInvoiceAmount(line.taxAmount) || !isValidInvoiceAmount(line.grandTotal)) throw new Error("Invalid service amount.");
    tax += vatMinorUnits(line.taxAmount);
    total += vatMinorUnits(line.grandTotal);
  }
  const totals = { grandTotalTaxAmount: formatVatAmount(tax), grandTotalAmount: formatVatAmount(total) };
  if (!Object.values(totals).every(isValidInvoiceAmount)) throw new Error("Invoice total exceeds the supported amount range.");
  return totals;
}
