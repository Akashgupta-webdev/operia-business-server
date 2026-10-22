import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/modules/user/models/user.model.js";
import Client from "../src/modules/clients/models/client.model.js";
import { prepareInvoiceForSave } from "../src/modules/clients/services/clientInvoicePersistence.service.js";
import ClientInvoice from "../src/modules/clients/models/clientInvoice.model.js";
import Counter from "../src/modules/common/models/counter.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import { allocateInvoiceNumber, listClientInvoices, validateInvoiceReferences } from "../src/modules/clients/services/clientInvoice.service.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import { createInvoiceSchema, updateInvoiceSchema, invoiceQuerySchema } from "../src/modules/clients/validators/clientInvoice.validator.js";

const client = "68ad00000000000000000001";
const item = "68ad00000000000000000002";
const id = "68ad00000000000000000003";
const payload = {
  clientId: client, companyId: item, invoiceType: "Operio To Client",
  customerName: "Example Client", fullAddress: "Dubai, UAE", trnNo: "12345",
  emailAddress: "client@example.com", issueDate: "2026-10-22T00:00:00.000Z",
  dueDate: "2026-11-22T00:00:00.000Z",
  service: [{ itemDescription: "Filing", qty: 1, govtRate: "0.00", servicePrice: "400.00", taxCode: 5, taxAmount: "20.00", grandTotal: "420.00" }],
};

test("invoice input protects generated fields, precision, enums and versioning", () => {
  assert.equal(createInvoiceSchema.validate(payload).error, undefined);
  for (const extra of [{ invoiceNo: "OP-custom" }, { invoiceType: "Other" }, { advanceAmount: 1.2 }]) {
    assert.ok(createInvoiceSchema.validate({ ...payload, ...extra }).error);
  }
  assert.ok(updateInvoiceSchema.validate({ expectedVersion: 0 }).error);
  assert.ok(updateInvoiceSchema.validate({ invoiceType: "Client To Customer" }).error);
  assert.equal(updateInvoiceSchema.validate({ expectedVersion: 0, invoiceType: "Client To Customer" }).error, undefined);
  assert.ok(invoiceQuerySchema.validate({ limit: 101 }).error);
});

test("create invoice requires the complete frontend payload and validates optional fields", () => {
  const required = ["clientId", "companyId", "invoiceType", "customerName", "fullAddress", "trnNo", "emailAddress", "issueDate", "dueDate", "service"];
  for (const field of required) {
    const input = { ...payload };
    delete input[field];
    assert.ok(createInvoiceSchema.validate(input).error, field);
    assert.ok(createInvoiceSchema.validate({ ...payload, [field]: null }).error, field);
    assert.ok(createInvoiceSchema.validate({ ...payload, [field]: "" }).error, field);
  }
  for (const extra of [{ service: [] }, { emailAddress: "invalid" }, { emirate: "London" },
    { contactNo: "+15551234567" }, { issueDate: "not-a-date" }, { dueDate: "not-a-date" },
    { fullAddres: "old spelling" }, { emailAddres: "old@example.com" },
    { grandTotalAmount: "420.00" }, { unexpected: true }]) {
    assert.ok(createInvoiceSchema.validate({ ...payload, ...extra }).error);
  }
  assert.equal(createInvoiceSchema.validate({ ...payload, service: [payload.service[0], payload.service[0]],
    emirate: "Dubai", contactNo: "+971501234567", accountNo: "123", switftBIC: "EXAMPLE", iban: "AE123" }).error, undefined);
});

test("yearly invoice numbers continue across days and reset at the UTC year boundary", async (t) => {
  const names = [];
  const counts = new Map();
  t.mock.method(Counter, "findOneAndUpdate", (filter, update) => {
    names.push(filter.name);
    assert.deepEqual(update, { $inc: { count: 1 } });
    const count = (counts.get(filter.name) ?? 0) + 1;
    counts.set(filter.name, count);
    return { exec: async () => ({ count }) };
  });
  assert.equal(await allocateInvoiceNumber(new Date("2026-09-03T00:01:00Z")), "OP-2026-0001");
  assert.equal(await allocateInvoiceNumber(new Date("2026-12-31T23:59:00Z")), "OP-2026-0002");
  assert.equal(await allocateInvoiceNumber(new Date("2027-01-01T00:00:00Z")), "OP-2027-0001");
  assert.deepEqual(names, ["client-invoice-2026", "client-invoice-2026", "client-invoice-2027"]);
});

test("invoice rejects companies belonging to another client and copies TRN", async (t) => {
  t.mock.method(Client, "exists", () => ({ session: async () => ({ _id: client }) }));
  let company = null;
  t.mock.method(ClientCompany, "findOne", () => ({
    session() { return this; }, lean() { return this; }, exec: async () => company,
  }));
  await assert.rejects(validateInvoiceReferences({ ...payload }), { code: "INVOICE_COMPANY_MISMATCH" });
  company = { vatTaxRegistrationNumber: "12345" };
  const invoice = { ...payload };
  await validateInvoiceReferences(invoice);
  assert.equal(invoice.trnNo, "12345");
});

test("list searches both names literally and returns stable pagination", async (t) => {
  let invoiceFilter;
  for (const Model of [Client, ClientCompany]) {
    t.mock.method(Model, "find", (filter) => {
      const expression = Object.values(filter)[0];
      assert.equal(expression.source, "A\\+B");
      return { select() { return this; }, lean() { return this; }, exec: async () => [{ _id: client }] };
    });
  }
  t.mock.method(ClientInvoice, "find", (filter) => {
    invoiceFilter = filter;
    return {
      sort(value) { assert.deepEqual(value, { createdAt: -1, _id: 1 }); return this; },
      skip(value) { assert.equal(value, 10); return this; }, limit() { return this; },
      select() { return this; }, lean() { return this; },
      populate() { return this; }, exec: async () => [{
        _id: new mongoose.Types.ObjectId(id), invoiceNo: "OP-2026-0001",
        clientId: { name: "A+B" }, customerName: "Customer",
        invoiceType: "Operio To Client", grandTotalAmount: "420.00",
        issueDate: payload.issueDate, dueDate: payload.dueDate,
        service: payload.service,
      }],
    };
  });
  t.mock.method(ClientInvoice, "countDocuments", () => ({ exec: async () => 11 }));
  const result = await listClientInvoices({ page: 2, limit: 10, search: "A+B" });
  assert.equal(invoiceFilter.$or.length, 2);
  assert.deepEqual(result.data, [{
    _id: id, invoiceId: "OP-2026-0001", clientName: "A+B",
    customerName: "Customer", invoiceType: "Operio To Client",
    grandTotalAmount: "420.00", issueDate: payload.issueDate, dueDate: payload.dueDate,
  }]);
  assert.deepEqual(result.page, { page: 2, limit: 10, total: 11, totalPages: 2 });
});

test("invoice HTTP routes enforce authorization and support create/read/update/delete", async (t) => {
  const config = {
    accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
    refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
    accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800,
    cookieSecure: false, issuer: "insurance-crm", audience: "insurance-crm-web",
  };
  process.env.AUTH_ACCESS_TOKEN_SECRET = config.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = config.refreshTokenSecret;
  let role = "ADMIN";
  let saved;
  t.mock.method(User, "findById", () => ({ exec: async () => ({ _id: "user-123", role, status: "ACTIVE", version: 0 }) }));
  t.mock.method(Client, "exists", () => ({ session: async () => ({ _id: client }) }));
  t.mock.method(ClientCompany, "findOne", () => ({ session() { return this; }, lean() { return this; }, exec: async () => ({ vatTaxRegistrationNumber: "12345" }) }));
  t.mock.method(Counter, "findOneAndUpdate", () => ({ exec: async () => ({ count: 1 }) }));
  t.mock.method(ClientInvoice.prototype, "save", async function saveTestInvoice() {
    await this.validate();
    await prepareInvoiceForSave.call(this);
    this.isNew = false;
    this._id = new mongoose.Types.ObjectId(id);
    this.version = this.version == null ? 0 : this.version + 1;
    saved = this;
    return this;
  });
  t.mock.method(ClientInvoice.prototype, "populate", async function populateTestInvoice() { return this; });
  t.mock.method(ClientInvoice, "findById", () => ({ populate() { return this; }, exec: async () => saved }));
  t.mock.method(ClientInvoice, "findOneAndDelete", (filter) => ({
    exec: async () => filter.version === saved?.version ? saved : null,
  }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { accessToken } = issueTokenPair({ id: "user-123", role: "ADMIN" }, "session-123", config);
  const headers = { "Content-Type": "application/json", Cookie: `accessToken=${accessToken}` };
  const base = `http://127.0.0.1:${server.address().port}/api/v1/client/invoices`;
  assert.equal((await fetch(base)).status, 401);
  role = "AGENT";
  assert.equal((await fetch(base, { headers })).status, 403);
  role = "ADMIN";
  const invalid = await fetch(base, { method: "POST", headers, body: JSON.stringify({ ...payload, fullAddress: undefined }) });
  assert.equal(invalid.status, 422);
  const invalidBody = await invalid.json();
  assert.equal(invalidBody.error.code, "VALIDATION_FAILED");
  assert.ok(invalidBody.error.details.some((detail) => detail.field === "fullAddress"));
  assert.equal(saved, undefined);
  const wrongTrn = await fetch(base, { method: "POST", headers, body: JSON.stringify({ ...payload, trnNo: "wrong" }) });
  assert.equal(wrongTrn.status, 422);
  assert.equal((await wrongTrn.json()).error.code, "INVOICE_TRN_MISMATCH");
  assert.equal(saved, undefined);
  const created = await fetch(base, { method: "POST", headers, body: JSON.stringify(payload) });
  const creation = await created.json();
  assert.equal(created.status, 201, JSON.stringify(creation));
  assert.equal(creation.data.fullAddress, payload.fullAddress);
  assert.equal(creation.data.emailAddress, payload.emailAddress);
  assert.equal(creation.data.trnNo, payload.trnNo);
  assert.equal(creation.data.grandTotalAmount.$numberDecimal, "420.00");
  assert.equal(creation.data.grandTotalTaxAmount.$numberDecimal, "20.00");
  assert.match(creation.data.invoiceNo, /^OP-\d{4}-0001$/);
  assert.equal(created.headers.get("location"), `/api/v1/client/invoices/${id}`);
  const detailResponse = await fetch(`${base}/${id}`, { headers });
  assert.equal(detailResponse.status, 200);
  assert.equal(detailResponse.headers.get("etag"), '"0"');
  const detail = await detailResponse.json();
  assert.equal(detail.data.id, id);
  assert.equal(detail.data.invoiceNo, creation.data.invoiceNo);
  assert.equal(detail.data.grandTotalAmount, 420);
  assert.equal(detail.data.grandTotalTaxAmount, 20);
  assert.deepEqual(detail.data.service[0], {
    itemDescription: "Filing", qty: 1, govtRate: 0, servicePrice: 400,
    taxCode: 5, taxAmount: 20, grandTotal: 420,
  });
  assert.equal(saved.service[0].servicePrice.toString(), "400.00");
  assert.ok(detail.meta.correlationId);
  const updated = await fetch(`${base}/${id}`, {
    method: "PATCH", headers, body: JSON.stringify({ expectedVersion: 0, invoiceType: "Client To Customer" }),
  });
  assert.equal(updated.status, 200);
  const update = await updated.json();
  assert.equal(update.data.invoiceType, "Client To Customer");
  assert.equal(update.data.invoiceNo, creation.data.invoiceNo);
  assert.equal(updated.headers.get("etag"), '"1"');
  assert.equal((await fetch(`${base}/${id}?expectedVersion=0`, { method: "DELETE", headers })).status, 409);
  const deleted = await fetch(`${base}/${id}?expectedVersion=1`, { method: "DELETE", headers });
  assert.equal(deleted.status, 200);
  assert.deepEqual((await deleted.json()).data, { id, deleted: true });
  saved = null;
  assert.equal((await fetch(`${base}/${id}`, { headers })).status, 404);
});
