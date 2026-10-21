// Reference examples for the admin-only Invoice API; this module sends no requests.
// Replace example ids with existing records belonging to the same client/company.
const clientId = "68ad00000000000000000001";
const companyId = "68ad00000000000000000002";
const invoiceId = "68ad00000000000000000004";
const meta = { correlationId: "request-correlation-id" };
const payload = {
  clientId, companyId, invoiceType: "Operio To Client", trnNo: "104679354100003",
  customerName: "Example Client", emirate: "Dubai", contactNo: "+971501234567",
  fullAddress: "Dubai, UAE", emailAddress: "client@example.com",
  issueDate: "2026-09-03T00:00:00.000Z", dueDate: "2026-09-30T00:00:00.000Z",
  accountNo: "123456789", switftBIC: "EXAMPLE", iban: "AE000000000000000000000",
  service: [{ itemDescription: "VAT filing", qty: 1, govtRate: "0.00",
    servicePrice: "400.00", taxCode: 5, taxAmount: "20.00", grandTotal: "420.00" }],
};
const invoice = {
  ...payload, id: invoiceId, invoiceNo: "OP-2026-0001",
  trnNo: "104679354100003",
  clientId: { id: clientId, name: "Example Client" },
  companyId: { id: companyId, companyName: "Example Company" },
  service: [{ ...payload.service[0], govtRate: { $numberDecimal: "0.00" },
    servicePrice: { $numberDecimal: "400.00" }, taxAmount: { $numberDecimal: "20.00" },
    grandTotal: { $numberDecimal: "420.00" } }],
  grandTotalTaxAmount: { $numberDecimal: "20.00" },
  grandTotalAmount: { $numberDecimal: "420.00" },
  version: 0, createdAt: "2026-09-03T10:00:00.000Z", updatedAt: "2026-09-03T10:00:00.000Z",
};

export const invoiceRoutes = [
  {
    method: "GET",
    route: "/api/v1/client/invoices?page=1&limit=25&search=Example",
    requestPayload: null,
    query: { page: 1, limit: 25, search: "Example" },
    responseStatus: 200,
    responseBody: { data: [{ _id: invoice.id, invoiceId: invoice.invoiceNo, clientName: invoice.clientId.name, customerName: invoice.customerName, invoiceType: invoice.invoiceType, grandTotalAmount: invoice.grandTotalAmount, issueDate: invoice.issueDate, dueDate: invoice.dueDate }], page: { page: 1, limit: 25, total: 1, totalPages: 1 }, meta },
  },
  {
    method: "GET",
    route: `/api/v1/client/invoices/${invoiceId}`,
    requestPayload: null,
    responseStatus: 200,
    responseBody: { data: invoice, meta },
  },
  {
    method: "POST",
    route: "/api/v1/client/invoices",
    requestPayload: payload,
    responseStatus: 201,
    responseHeaders: { Location: `/api/v1/client/invoices/${invoiceId}`, ETag: '"0"' },
    responseBody: { data: invoice, meta },
  },
  {
    method: "PATCH",
    route: `/api/v1/client/invoices/${invoiceId}`,
    requestPayload: { expectedVersion: 0, invoiceType: "Client To Customer" },
    responseStatus: 200,
    responseHeaders: { ETag: '"1"' },
    responseBody: {
      data: {
        ...invoice, invoiceType: "Client To Customer",
        version: 1, updatedAt: "2026-09-03T11:00:00.000Z",
      },
      meta,
    },
  },
  {
    method: "DELETE",
    route: `/api/v1/client/invoices/${invoiceId}?expectedVersion=1`,
    query: { expectedVersion: 1 },
    requestPayload: null,
    responseStatus: 200,
    responseBody: { data: { id: invoiceId, deleted: true }, meta },
  },
];

export const invoiceErrorExample = {
  error: { code: "VERSION_CONFLICT", message: "The invoice changed. Reload and retry.", details: [] },
  meta,
};
