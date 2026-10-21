import { calculateInvoiceTotals } from "../utils/clientInvoice.utils.js";
import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";
import { createCountId } from "../../common/services/counter.service.js";
import { ClientInvoiceError } from "../errors/clientInvoice.error.js";

// Allocates a shared yearly sequence using the existing atomic counter service.
// UTC creation year determines the prefix; failed saves may leave sequence gaps.
export async function allocateInvoiceNumber(now = new Date(), session) {
  const year = now.toISOString().slice(0, 4);
  const sequence = await createCountId("client-invoice-" + year, session);
  return "OP-" + year + "-" + String(sequence).padStart(4, "0");
}

// Verifies company ownership and snapshots its current VAT registration number.
// All database operations remain in services, including save middleware helpers.
export async function validateInvoiceReferences(invoice) {
  const session = invoice.$session?.() ?? null;
  if (!await Client.exists({ _id: invoice.clientId }).session(session)) {
    throw new ClientInvoiceError("CLIENT_NOT_FOUND", "The client was not found.", 404);
  }
  const company = await ClientCompany.findOne({ _id: invoice.companyId, client: invoice.clientId }).session(session).lean().exec();
  if (!company) throw new ClientInvoiceError("INVOICE_COMPANY_MISMATCH", "The company does not belong to this client.");
  if (invoice.isNew && invoice.trnNo !== undefined && invoice.trnNo !== company.vatTaxRegistrationNumber) {
    throw new ClientInvoiceError("INVOICE_TRN_MISMATCH", "trnNo must match the selected company's VAT registration number.", 422,
      [{ field: "trnNo", issue: "Use the selected company's vatTaxRegistrationNumber." }]);
  }
  invoice.trnNo = company.vatTaxRegistrationNumber;
}

// Prepares company information and generated identity for document saves.
// New invoices receive a counter number regardless of caller-supplied values.
export async function prepareInvoiceForSave() {
  Object.assign(this, calculateInvoiceTotals(this.service));
  await validateInvoiceReferences(this);
  if (this.isNew) this.invoiceNo = await allocateInvoiceNumber(this.$locals.invoiceNow ?? new Date(), this.$session());
}
