import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import { prepareVatServiceCreation } from "../src/modules/clients/services/clientVatCreation.service.js";
import { updateClientService, deleteClientService } from "../src/modules/clients/services/clientService.service.js";
import { deleteClientDocument } from "../src/modules/clients/services/clientDocument.service.js";
import { validateVatEvidence, buildVatListFilter, countVatDue, executeVatAction } from "../src/modules/clients/services/clientVat.service.js";
import { applyVatAction } from "../src/modules/clients/utils/clientVatWorkflow.utils.js";
import { assertVatVersion, parseVatDate, vatToday, vatMinorUnits, formatVatAmount } from "../src/modules/clients/utils/clientVat.utils.js";
import { vatActionSchemas, vatDateSchema } from "../src/modules/clients/validators/clientVat.validator.js";
import { createClientServiceSchema } from "../src/modules/clients/validators/clientService.validator.js";
import { createClientDocumentBodySchema } from "../src/modules/clients/validators/clientDocument.validator.js";
import { normalizeVatError } from "../src/modules/clients/errors/clientVat.error.js";

const clientId = new mongoose.Types.ObjectId(), companyId = new mongoose.Types.ObjectId();
const sourceId = new mongoose.Types.ObjectId(), paperId = new mongoose.Types.ObjectId(), evidenceId = new mongoose.Types.ObjectId();
const now = new Date("2026-07-20T10:00:00Z");
const draft = { outputVat: "1000.10", recoverableInputVat: "500.05", workingPaper: String(paperId), sourceDocuments: [String(sourceId)] };

// Creates realistic Mongoose filings so subdocument casting participates in tests.
// Fixed dates and IDs keep period and money assertions deterministic.
function filing() {
  return new ClientService({
    client: clientId, company: companyId, serviceCode: "VAT_RETURN_FILING",
    category: "Tax & Accounting", package: "Quarterly VAT Return Filing Package",
    dueDate: parseVatDate("28-07-2026"), status: "Pending", version: 0,
    paymentStatus: "Unpaid", details: { vat: { trn: "100000000000001", periodStart: parseVatDate("01-04-2026"), periodEnd: parseVatDate("30-06-2026") } },
  });
}

// Advances a draft through both review steps using the real transition function.
// The helper intentionally leaves submission and payment to individual tests.
function approvedFiling() {
  const service = filing();
  for (const [action, input] of [
    ["prepare", draft], ["request-review", {}], ["approve-review", {}],
    ["record-approval", { approverName: "Client Signatory", document: String(evidenceId) }],
  ]) applyVatAction(service, action, input, "admin", now);
  return service;
}

test("VAT dates reject rollover and observe Dubai midnight", () => {
  assert.equal(vatDateSchema.validate("29-02-2024").error, undefined);
  for (const date of ["29-02-2025", "31-04-2026", "01-13-2026", "2026-01-01", "01-01-0099"]) assert.ok(vatDateSchema.validate(date).error);
  assert.equal(vatToday(new Date("2026-07-19T20:00:00Z")).toISOString(), "2026-07-20T00:00:00.000Z");
});

test("VAT calculations are exact, including large values and credit positions", () => {
  assert.equal(formatVatAmount(vatMinorUnits("0.30") - vatMinorUnits("0.20")), "0.10");
  const service = filing();
  applyVatAction(service, "prepare", { ...draft, outputVat: "0", recoverableInputVat: "1.01" }, "admin", now);
  assert.equal(service.details.vat.calculation.netVat.toString(), "-1.01");
  assert.equal(service.details.vat.settlement.status, "CREDIT");
  applyVatAction(service, "prepare", { ...draft, outputVat: "0", recoverableInputVat: "0" }, "admin", now);
  assert.equal(service.details.vat.settlement.status, "NOT_DUE");
  applyVatAction(service, "prepare", { ...draft, outputVat: "999999999999999.99", recoverableInputVat: "-999999999999999.99" }, "admin", now);
  assert.equal(service.details.vat.calculation.netVat.toString(), "1999999999999999.98");
});

test("review cannot be skipped and approval is invalidated on changed calculations", () => {
  const unprepared = filing();
  assert.throws(() => applyVatAction(unprepared, "request-review", {}, "admin", now), { code: "INVALID_TRANSITION" });
  const service = approvedFiling();
  assert.equal(service.details.vat.approval.revision, 1);
  applyVatAction(service, "prepare", { ...draft, outputVat: "2000.00" }, "admin", now);
  assert.equal(service.details.vat.approval, undefined);
  assert.equal(service.details.vat.review, undefined);
  assert.equal(service.details.vat.revision, 2);
  assert.equal(service.details.vat.history[0].calculation.outputVat.toString(), "1000.10");
  assert.throws(() => applyVatAction(service, "record-submission", { submittedOn: "20-07-2026" }, "admin", now), { code: "INVALID_TRANSITION" });
});

test("filing completion does not pay tax or service fees and locks return data", async () => {
  const service = approvedFiling();
  applyVatAction(service, "record-submission", { submittedOn: "20-07-2026", reference: "FTA-123", document: String(evidenceId) }, "admin", now);
  assert.equal(service.status, "Completed");
  assert.equal(service.paymentStatus, "Unpaid");
  assert.equal(service.details.vat.settlement.status, "UNPAID");
  await service.validate();
  for (const action of ["prepare", "revise-period", "cancel", "return-for-correction"]) assert.throws(() => applyVatAction(service, action, draft, "admin", now), { code: "VAT_FILED_LOCKED" });
  applyVatAction(service, "record-tax-payment", { amountPaid: "100.00", paidOn: "20-07-2026", document: String(evidenceId) }, "admin", now);
  assert.equal(service.details.vat.settlement.status, "PARTIAL");
  assert.throws(() => applyVatAction(service, "record-tax-payment", { amountPaid: "500.05", paidOn: "20-07-2026", document: String(evidenceId) }, "admin", now), { code: "VALIDATION_FAILED" });
  applyVatAction(service, "record-tax-payment", { amountPaid: "500.05", paidOn: "20-07-2026", document: String(evidenceId), reason: "Additional payment reconciled" }, "admin", now);
  assert.equal(service.details.vat.settlement.status, "PAID");
  assert.equal(service.paymentStatus, "Unpaid");
});

test("future submission, stale approval and overpayment are rejected", () => {
  const service = approvedFiling();
  assert.throws(() => applyVatAction(service, "record-submission", { submittedOn: "21-07-2026" }, "admin", now), { code: "VALIDATION_FAILED" });
  service.details.vat.approval.revision = 0;
  assert.throws(() => applyVatAction(service, "record-submission", { submittedOn: "20-07-2026" }, "admin", now), { code: "VAT_APPROVAL_REQUIRED" });
  service.details.vat.approval.revision = 1;
  applyVatAction(service, "record-submission", { submittedOn: "20-07-2026", reference: "FTA-1", document: String(evidenceId) }, "admin", now);
  assert.throws(() => applyVatAction(service, "record-tax-payment", { amountPaid: "600.00", paidOn: "20-07-2026" }, "admin", now), { code: "VALIDATION_FAILED" });
});

test("cancellation retains the filing and reopening requires renewed approval", () => {
  const service = approvedFiling();
  applyVatAction(service, "cancel", { reason: "Engagement paused" }, "admin", now);
  assert.equal(service.details.vat.approval, undefined);
  assert.throws(() => applyVatAction(service, "prepare", draft, "admin", now), { code: "INVALID_TRANSITION" });
  applyVatAction(service, "reopen", {}, "admin", now);
  assert.equal(service.details.vat.stage, "PREPARING");
  assert.equal(service.status, "In Progress");
  assert.throws(() => applyVatAction(service, "reopen", {}, "admin", now), { code: "INVALID_TRANSITION" });
});

test("period revision clears financial approval and requires coherent dates", () => {
  const service = approvedFiling();
  applyVatAction(service, "revise-period", { periodStart: "01-05-2026", periodEnd: "31-07-2026", dueDate: "28-08-2026", reason: "FTA period corrected" }, "admin", now);
  assert.equal(service.details.vat.calculation, undefined);
  assert.equal(service.details.vat.approval, undefined);
  assert.throws(() => applyVatAction(service, "revise-period", { periodStart: "31-07-2026", periodEnd: "01-05-2026", dueDate: "28-08-2026" }, "admin", now), { code: "VALIDATION_FAILED" });
});

test("unknown and server-owned VAT fields and invalid monetary values are rejected", () => {
  assert.ok(vatActionSchemas.prepare.validate({ expectedVersion: 0, ...draft, stage: "FILED" }).error);
  assert.ok(vatActionSchemas.prepare.validate({ expectedVersion: 0, ...draft, outputVat: 12.34 }).error);
  assert.ok(vatActionSchemas["request-review"].validate({}).error);
  assert.ok(createClientServiceSchema.validate({ details: { vat: { periodStart: "01-01-2026", periodEnd: "31-03-2026", trn: "100000000000001" } } }).error);
  assert.ok(createClientDocumentBodySchema.validate({ service: String(companyId) }).error);
  assert.ok(createClientDocumentBodySchema.validate({ purpose: "SOURCE" }).error);
});

test("company ownership and aggregate creation share the same VAT validation", async (t) => {
  const input = { serviceCode: "VAT_RETURN_FILING", category: "Tax & Accounting", package: "Quarterly VAT Return Filing Package", company: String(companyId), dueDate: "28-07-2026", details: { vat: { periodStart: "01-04-2026", periodEnd: "30-06-2026" } } };
  const company = { _id: companyId, client: clientId, vatTaxRegistrationNumber: "100000000000001" };
  t.mock.method(ClientCompany, "findOne", (filter) => {
    assert.equal(String(filter.client), String(clientId));
    return { session() { return this; }, async exec() { return company; } };
  });
  const standalone = await prepareVatServiceCreation(clientId, input);
  const { company: ignored, ...aggregateInput } = input;
  const aggregate = await prepareVatServiceCreation(clientId, aggregateInput, { company });
  assert.deepEqual(standalone, aggregate);
  await assert.rejects(prepareVatServiceCreation(clientId, input, { company }), { code: "VALIDATION_FAILED" });
  await assert.rejects(prepareVatServiceCreation(clientId, aggregateInput, { company: { ...company, client: new mongoose.Types.ObjectId() } }), { code: "VALIDATION_FAILED" });
  await assert.rejects(prepareVatServiceCreation(clientId, aggregateInput, { company: { ...company, vatTaxRegistrationNumber: "bad" } }), { code: "VALIDATION_FAILED" });
  await assert.rejects(prepareVatServiceCreation(clientId, { status: "Pending", dueDate: "28-07-2026" }), { code: "VALIDATION_FAILED" });
});

test("evidence query is scoped to both client and filing and rejects missing evidence", async (t) => {
  const service = filing();
  t.mock.method(ClientDocument, "countDocuments", (filter) => {
    assert.equal(filter.client, service.client);
    assert.equal(filter.service, service._id);
    assert.equal(filter.purpose, "SOURCE");
    return { session() { return this; }, async exec() { return 0; } };
  });
  await assert.rejects(validateVatEvidence(service, [String(sourceId)], "SOURCE"), { code: "VAT_EVIDENCE_REQUIRED" });
});

test("generic edits cannot bypass VAT lifecycle or optimistic version checks", async (t) => {
  const service = filing();
  t.mock.method(ClientService, "findById", () => ({ async exec() { return service; } }));
  t.mock.method(service, "save", async () => service);
  await assert.rejects(updateClientService(String(service._id), { expectedVersion: 0, status: "Completed" }), { code: "VAT_ACTION_REQUIRED" });
  await assert.rejects(updateClientService(String(service._id), { notes: ["x"] }), { code: "VERSION_CONFLICT" });
  await assert.rejects(deleteClientService(String(service._id)), { code: "VAT_HISTORY_RETAINED" });
  await updateClientService(String(service._id), { expectedVersion: 0, packagePrice: "500.00" });
  assert.equal(service.packagePrice.toString(), "500.00");
  assert.throws(() => assertVatVersion(service, 9), { code: "VERSION_CONFLICT" });
});

test("retained filing documents cannot be deleted before Cloudinary cleanup", async (t) => {
  t.mock.method(ClientDocument, "findById", () => ({ select() { return this; }, async exec() { return { service: companyId }; } }));
  await assert.rejects(deleteClientDocument(String(sourceId)), { code: "VAT_HISTORY_RETAINED" });
});

test("list and KPI deadline boundaries use indexable dates", async (t) => {
  const filter = buildVatListFilter({ fromDate: "01-07-2026", toDate: "28-07-2026", stage: "PREPARING" });
  assert.equal(filter.dueDate.$lte.toISOString(), "2026-07-28T00:00:00.000Z");
  assert.throws(() => buildVatListFilter({ fromDate: "28-07-2026", toDate: "01-07-2026" }), { code: "VALIDATION_FAILED" });
  t.mock.method(ClientService, "countDocuments", (query) => {
    assert.equal(query.dueDate.$lte.toISOString(), "2026-09-18T00:00:00.000Z");
    assert.deepEqual(query.status.$nin, ["Completed", "Cancelled"]);
    return { async exec() { return 3; } };
  });
  assert.equal(await countVatDue(new Date("2026-07-19T20:00:00Z")), 3);
});

test("duplicate database keys and concurrent versions become safe conflicts", () => {
  assert.equal(normalizeVatError({ code: 11000 }).code, "VAT_PERIOD_EXISTS");
  assert.equal(normalizeVatError({ name: "VersionError" }).code, "VERSION_CONFLICT");
  const indexes = ClientService.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys["details.vat.trn"] && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.previousService && options.unique));
});

test("command service rejects stale versions before evidence or writes", async (t) => {
  t.mock.method(mongoose.connection, "transaction", async (operation) => operation({}));
  t.mock.method(ClientService, "findOne", () => ({ session() { return this; }, async exec() { return filing(); } }));
  await assert.rejects(executeVatAction(String(companyId), "prepare", { ...draft, expectedVersion: 5 }, "admin", now), { code: "VERSION_CONFLICT" });
});

test("VAT model rejects incomplete filings and unrelated duplicate errors retain their identity", async () => {
  const invalid = new ClientService({ client: clientId, serviceCode: "VAT_RETURN_FILING" });
  await assert.rejects(invalid.validate(), { name: "ValidationError" });
  const unrelated = { code: 11000, keyPattern: { email: 1 } };
  assert.equal(normalizeVatError(unrelated), unrelated);
});
