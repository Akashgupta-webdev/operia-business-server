import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientReminder from "../src/modules/clients/models/clientReminder.model.js";
import { createClientService } from "../src/modules/clients/services/clientService.service.js";
import { executeVatAction } from "../src/modules/clients/services/clientVat.service.js";

const uri = process.env.VAT_TEST_MONGODB_URI;
if (!uri) throw new Error("Set VAT_TEST_MONGODB_URI to a dedicated local MongoDB replica set.");
const database = `vat_test_${Date.now()}_${process.pid}`;

test("real MongoDB VAT uniqueness, concurrency, rollback and recurrence", async (t) => {
  await mongoose.connect(uri, { dbName: database, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  t.after(async () => {
    // The test owns this generated database and never uses the URI's database name.
    // Guard the name before dropping only the isolated integration-test database.
    if (mongoose.connection.name === database && database.startsWith("vat_test_")) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  for (const model of [Client, ClientCompany, ClientService, ClientDocument, ClientReminder]) await model.createCollection();
  for (const model of [ClientService, ClientDocument, ClientReminder]) await model.createIndexes();
  const client = await Client.create({ name: "VAT Integration Client", clientType: "COMPANY" });
  const company = await ClientCompany.create({ client: client._id, companyName: "VAT Integration Company", vatTaxRegistrationNumber: "100000000000001" });
  const input = {
    company: String(company._id), serviceCode: "VAT_RETURN_FILING",
    category: "Tax & Accounting", package: "Quarterly VAT Return Filing Package",
    dueDate: "28-07-2026", details: { vat: { periodStart: "01-04-2026", periodEnd: "30-06-2026" } },
  };
  let service = await createClientService(String(client._id), input);
  await assert.rejects(createClientService(String(client._id), input), { code: "VAT_PERIOD_EXISTS" });
  const evidence = {};
  for (const purpose of ["SOURCE", "WORKING_PAPER", "APPROVAL", "ACKNOWLEDGMENT", "TAX_PAYMENT"]) {
    evidence[purpose] = String((await ClientDocument.create({ client: client._id, service: service._id, purpose, documentTitle: purpose }))._id);
  }
  const now = new Date("2026-07-20T12:00:00Z");
  const racing = await Promise.allSettled([
    executeVatAction(String(service._id), "schedule-reminder", { expectedVersion: 0, followupDate: "21-07-2026", notes: [] }, "admin", now),
    executeVatAction(String(service._id), "schedule-reminder", { expectedVersion: 0, followupDate: "22-07-2026", notes: [] }, "admin", now),
  ]);
  assert.equal(racing.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(racing.find((result) => result.status === "rejected").reason.code, "VERSION_CONFLICT");
  assert.equal(await ClientReminder.countDocuments({ service: service._id }), 1);
  service = await ClientService.findById(service._id);
  const originalSave = ClientService.prototype.save;
  const failingSave = t.mock.method(ClientService.prototype, "save", async function failAfterReminderWrite() { throw new Error("Injected persistence failure"); });
  await assert.rejects(executeVatAction(String(service._id), "complete-reminder", { expectedVersion: service.version }, "admin", now), /Injected persistence failure/);
  failingSave.mock.restore();
  assert.equal(ClientService.prototype.save, originalSave);
  assert.equal((await ClientReminder.findOne({ service: service._id })).state, "PENDING");
  assert.equal((await ClientService.findById(service._id)).version, service.version);
  const actions = [
    ["prepare", { outputVat: "1000.00", recoverableInputVat: "500.00", workingPaper: evidence.WORKING_PAPER, sourceDocuments: [evidence.SOURCE] }],
    ["request-review", {}], ["approve-review", {}],
    ["record-approval", { approverName: "Client Signatory", document: evidence.APPROVAL }],
    ["record-submission", { reference: "FTA-TEST-1", submittedOn: "20-07-2026", document: evidence.ACKNOWLEDGMENT }],
    ["record-tax-payment", { amountPaid: "500.00", paidOn: "20-07-2026", document: evidence.TAX_PAYMENT }],
  ];
  for (const [action, values] of actions) {
    ({ service } = await executeVatAction(String(service._id), action, { expectedVersion: service.version, ...values }, "admin", now));
  }
  assert.equal(service.details.vat.stage, "FILED");
  assert.equal(service.details.vat.settlement.status, "PAID");
  assert.equal((await ClientReminder.findOne({ service: service._id })).state, "CANCELLED");
  const next = await executeVatAction(String(service._id), "create-next-period", { expectedVersion: service.version, periodStart: "01-07-2026", periodEnd: "30-09-2026", dueDate: "28-10-2026" }, "admin", now);
  assert.equal(String(next.nextService.previousService), String(service._id));
  assert.equal(next.nextService.details.vat.stage, "AWAITING_DOCUMENTS");
  await assert.rejects(executeVatAction(String(service._id), "create-next-period", { expectedVersion: next.service.version, periodStart: "01-10-2026", periodEnd: "31-12-2026", dueDate: "28-01-2027" }, "admin", now), { code: "VAT_PERIOD_EXISTS" });
  assert.equal(await ClientService.countDocuments({ previousService: service._id }), 1);
});
