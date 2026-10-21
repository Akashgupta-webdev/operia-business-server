import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import ClientInvoice from "../src/modules/clients/models/clientInvoice.model.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import Counter from "../src/modules/common/models/counter.model.js";

// Builds a valid invoice with exact decimal line totals.
// Individual tests override fields to exercise the persistence rules.
function createInvoice() {
  return new ClientInvoice({
    clientId: new mongoose.Types.ObjectId(), companyId: new mongoose.Types.ObjectId(),
    contactNo: "+971501234567", emirate: "Dubai",
    service: [{ itemDescription: "Filing", qty: 1, govtRate: "0.00", servicePrice: "400.00", taxCode: 5, taxAmount: "20.00", grandTotal: "420.00" }],
  });
}

test("invoice stores exact totals and recalculates after line edits", async () => {
  const invoice = createInvoice();
  await invoice.validate();
  assert.equal(String(invoice.grandTotalAmount), "420.00");
  invoice.service[0].taxAmount = "0.01";
  invoice.service[0].grandTotal = "0.10";
  invoice.service.push({ ...invoice.service[0].toObject(), qty: 0.5, taxAmount: "0.02", grandTotal: "0.20" });
  invoice.grandTotalAmount = "999";
  await invoice.validate();
  assert.equal(String(invoice.grandTotalAmount), "0.30");
  assert.equal(String(invoice.grandTotalTaxAmount), "0.03");
});

test("invoice rejects invalid quantities, tax codes and money", async () => {
  for (const [field, value] of [["qty", 0], ["qty", -1], ["qty", Infinity],
    ["servicePrice", "-1"], ["govtRate", "0.001"], ["taxAmount", "NaN"],
    ["grandTotal", "-1"], ["taxCode", 10], ["itemDescription", ""]]) {
    const invoice = createInvoice();
    invoice.service[0].set(field, value);
    await assert.rejects(invoice.validate(), { name: "ValidationError" });
  }
  const invoice = createInvoice();
  invoice.service = [];
  await assert.rejects(invoice.validate(), { name: "ValidationError" });
});

test("invoice validates all emirates and UAE contact formats", async () => {
  for (const contactNo of ["0501234567", "+971501234567", "00971501234567", "041234567"]) {
    const invoice = createInvoice(); invoice.contactNo = contactNo; await invoice.validate();
  }
  for (const [field, value] of [["contactNo", "+15551234567"], ["contactNo", "050123"], ["emirate", "London"]]) {
    const invoice = createInvoice(); invoice.set(field, value);
    await assert.rejects(invoice.validate(), { name: "ValidationError" });
  }
});

test("actual save hooks generate numbers, copy TRN and persist updated totals", async (t) => {
  t.mock.method(Client, "exists", () => ({ session: async () => ({}) }));
  t.mock.method(ClientCompany, "findOne", () => ({
    session() { return this; }, lean() { return this; }, exec: async () => ({ vatTaxRegistrationNumber: "12345" }),
  }));
  let allocations = 0;
  t.mock.method(Counter, "findOneAndUpdate", () => ({ exec: async () => ({ count: ++allocations }) }));
  let stored;
  t.mock.method(ClientInvoice.collection, "insertOne", async (doc) => { stored = doc; return { acknowledged: true, insertedId: doc._id }; });
  t.mock.method(ClientInvoice.collection, "updateOne", async (_filter, update) => { stored = update.$set; return { acknowledged: true, matchedCount: 1, modifiedCount: 1 }; });
  const invoice = createInvoice();
  invoice.$locals.invoiceNow = new Date("2026-01-01T00:00:00Z");
  invoice.invoiceNo = "caller-supplied";
  await invoice.save();
  assert.equal(stored.invoiceNo, "OP-2026-0001");
  assert.equal(stored.trnNo, "12345");
  invoice.service[0].grandTotal = "500.00";
  await invoice.save();
  assert.equal(String(stored.grandTotalAmount), "500.00");
  assert.equal(allocations, 1);
});

test("query replacements persist exact totals and unsafe writes are rejected", async (t) => {
  let stored;
  t.mock.method(ClientInvoice.collection, "updateOne", async (_filter, update) => { stored = update.$set; return { matchedCount: 1 }; });
  const invoice = createInvoice();
  await ClientInvoice.updateOne({ _id: invoice._id }, { $set: { service: invoice.service.toObject() } });
  assert.equal(String(stored.grandTotalAmount), "420.00");
  assert.equal(String(stored.grandTotalTaxAmount), "20.00");
  for (const update of [{ $inc: { "service.0.taxAmount": 1 } }, { $set: { grandTotalAmount: "0" } }, { $unset: { service: 1 } }, { $rename: { customerName: "service" } }]) {
    await assert.rejects(ClientInvoice.updateOne({ _id: invoice._id }, update));
  }
  await assert.rejects(ClientInvoice.updateOne({}, { $set: { service: [] } }));
  await assert.rejects(ClientInvoice.insertMany([invoice.toObject()]));
  await assert.rejects(ClientInvoice.bulkWrite([]));
});
