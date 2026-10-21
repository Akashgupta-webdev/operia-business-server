import ClientInvoice from "../models/clientInvoice.model.js";
import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";
import { ClientInvoiceError } from "../errors/clientInvoice.error.js";
export { allocateInvoiceNumber, validateInvoiceReferences } from "./clientInvoicePersistence.service.js";

const editableFields = ["companyId", "invoiceType", "customerName", "emirate", "contactNo", "fullAddress", "emailAddress", "issueDate", "dueDate", "service", "accountNo", "switftBIC", "iban"];
const population = [
  { path: "clientId", select: "name mobileNumber emailAddress" },
  { path: "companyId", select: "companyName vatTaxRegistrationNumber" },
];

// Creates an invoice after validating its shape and referenced ownership.
// The generated number uses creation time even when issueDate is backdated.
export async function createClientInvoice(body, now = new Date()) {
  const invoice = new ClientInvoice({ ...body, issueDate: body.issueDate ?? now });
  invoice.$locals.invoiceNow = now;
  await invoice.save();
  return invoice.populate(population);
}

// Loads a single invoice and optionally expands its customer and line references.
// Missing records use the same stable error across read and mutation endpoints.
export async function getClientInvoice(id, populate = true) {
  const query = ClientInvoice.findById(id);
  if (populate) query.populate(population);
  const invoice = await query.exec();
  if (!invoice) throw new ClientInvoiceError("CLIENT_INVOICE_NOT_FOUND", "The invoice was not found.", 404);
  return invoice;
}

// Applies allow-listed edits with an explicit caller version and save-time concurrency.
// Client ownership and invoiceNo remain unchanged across edits.
export async function updateClientInvoice(id, body) {
  const invoice = await getClientInvoice(id, false);
  if (invoice.version !== body.expectedVersion) {
    throw new ClientInvoiceError("VERSION_CONFLICT", "The invoice changed. Reload and retry.", 409);
  }
  for (const field of editableFields) {
    if (body[field] !== undefined) invoice.set(field, body[field]);
  }
  await invoice.validate();
  await invoice.save();
  return invoice.populate(population);
}

// Deletes only the caller's observed version to avoid losing a concurrent edit.
// A missing id returns 404 while an existing newer version returns 409.
export async function deleteClientInvoice(id, expectedVersion) {
  const invoice = await ClientInvoice.findOneAndDelete({ _id: id, version: expectedVersion }).exec();
  if (!invoice) {
    await getClientInvoice(id, false);
    throw new ClientInvoiceError("VERSION_CONFLICT", "The invoice changed. Reload and retry.", 409);
  }
  return { id: invoice._id.toString(), deleted: true };
}

// Searches literal client/company names and paginates invoices with a stable tie-breaker.
// Returns list summaries with invoiceId mapped to the generated invoice number.
export async function listClientInvoices({ page, limit, search }) {
  const filter = {};
  if (search) {
    const expression = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const [clients, companies] = await Promise.all([
      Client.find({ name: expression }).select("_id").lean().exec(),
      ClientCompany.find({ companyName: expression }).select("_id").lean().exec(),
    ]);
    filter.$or = [
      { clientId: { $in: clients.map((client) => client._id) } },
      { companyId: { $in: companies.map((company) => company._id) } },
    ];
  }
  const [data, total] = await Promise.all([
    ClientInvoice.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * limit)
      .limit(limit)
      .select("_id invoiceNo clientId customerName invoiceType grandTotalAmount issueDate dueDate")
      .populate({ path: "clientId", select: "name" }).lean().exec(),
    ClientInvoice.countDocuments(filter).exec(),
  ]);
  return {
    data: data.map((invoice) => ({
      _id: invoice._id.toString(),
      invoiceId: invoice.invoiceNo ?? null,
      clientName: invoice.clientId?.name ?? null,
      customerName: invoice.customerName ?? null,
      invoiceType: invoice.invoiceType ?? null,
      grandTotalAmount: invoice.grandTotalAmount ?? null,
      issueDate: invoice.issueDate ?? null,
      dueDate: invoice.dueDate ?? null,
    })),
    page: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
