import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/modules/user/models/user.model.js";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientReminder from "../src/modules/clients/models/clientReminder.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import { parseVatDate } from "../src/modules/clients/utils/clientVat.utils.js";

const config = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800,
  cookieSecure: false, issuer: "insurance-crm", audience: "insurance-crm-web",
};

test("VAT HTTP flow enforces permissions, validation, versions and response envelopes", async (t) => {
  const oldAccess = process.env.AUTH_ACCESS_TOKEN_SECRET;
  const oldRefresh = process.env.AUTH_REFRESH_TOKEN_SECRET;
  process.env.AUTH_ACCESS_TOKEN_SECRET = config.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = config.refreshTokenSecret;
  t.after(() => {
    if (oldAccess === undefined) delete process.env.AUTH_ACCESS_TOKEN_SECRET; else process.env.AUTH_ACCESS_TOKEN_SECRET = oldAccess;
    if (oldRefresh === undefined) delete process.env.AUTH_REFRESH_TOKEN_SECRET; else process.env.AUTH_REFRESH_TOKEN_SECRET = oldRefresh;
  });
  const serviceId = new mongoose.Types.ObjectId();
  const documentId = new mongoose.Types.ObjectId().toString();
  let role = "ADMIN";
  let status = "ACTIVE";
  const service = new ClientService({
    _id: serviceId, client: new mongoose.Types.ObjectId(), company: new mongoose.Types.ObjectId(),
    serviceCode: "VAT_RETURN_FILING", category: "Tax & Accounting", package: "Quarterly VAT Return Filing Package",
    status: "Pending", version: 0, dueDate: parseVatDate("28-07-2026"),
    details: { vat: { trn: "100000000000001", periodStart: parseVatDate("01-04-2026"), periodEnd: parseVatDate("30-06-2026") } },
  });
  t.mock.method(User, "findById", () => ({ async exec() { return { _id: "admin-1", role, status, version: 0 }; } }));
  t.mock.method(mongoose.connection, "transaction", async (operation) => operation({}));
  t.mock.method(ClientService, "findOne", () => ({ session() { return this; }, async exec() { return service; } }));
  t.mock.method(service, "save", async () => { await service.validate(); service.version += 1; return service; });
  t.mock.method(ClientDocument, "countDocuments", (filter) => ({ session() { return this; }, async exec() { return filter._id.$in.length; } }));
  t.mock.method(ClientReminder, "updateOne", async () => ({}));
  t.mock.method(ClientDocument, "find", () => ({ sort() { return this; }, async exec() { return []; } }));
  t.mock.method(ClientReminder, "findOne", () => ({ async exec() { return null; } }));
  t.mock.method(ClientService, "find", () => ({ sort() { return this; }, skip() { return this; }, limit() { return this; }, async exec() { return [service]; } }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = issueTokenPair({ id: "admin-1", role: "ADMIN" }, "session", config).accessToken;
  const headers = { "Content-Type": "application/json", Cookie: `accessToken=${token}` };
  const base = `http://127.0.0.1:${server.address().port}/api/v1/client`;
  const endpoint = `${base}/service/${serviceId}/vat`;

  assert.equal((await fetch(`${base}/services`)).status, 401);
  status = "INACTIVE";
  assert.equal((await fetch(`${base}/services`, { headers })).status, 401);
  status = "ACTIVE";
  role = "AGENT";
  assert.equal((await fetch(`${base}/services`, { headers })).status, 403);
  role = "ADMIN";
  assert.equal((await fetch(`${endpoint}/request-review`, { method: "POST", headers, body: "{}" })).status, 422);
  const actions = [
    ["prepare", { outputVat: "1000.10", recoverableInputVat: "500.05", workingPaper: documentId, sourceDocuments: [documentId] }],
    ["request-review", {}],
    ["approve-review", {}],
    ["record-approval", { approverName: "Client Signatory", document: documentId }],
    ["record-submission", { reference: "FTA-TEST", submittedOn: "20-07-2026", document: documentId }],
    ["record-tax-payment", { amountPaid: "500.05", paidOn: "20-07-2026", document: documentId }],
  ];
  for (const [action, input] of actions) {
    const previousVersion = service.version;
    const response = await fetch(`${endpoint}/${action}`, { method: "POST", headers, body: JSON.stringify({ expectedVersion: previousVersion, ...input }) });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify(body));
    assert.equal(response.headers.get("etag"), `"${previousVersion + 1}"`);
    assert.equal(body.data.service.id, String(serviceId));
    assert.ok(body.meta.correlationId);
  }
  const stale = await fetch(`${endpoint}/cancel`, { method: "POST", headers, body: JSON.stringify({ expectedVersion: 0, reason: "stale" }) });
  assert.equal(stale.status, 409);
  assert.equal((await stale.json()).error.code, "VERSION_CONFLICT");
  const detail = await fetch(`${base}/service/${serviceId}`, { headers });
  assert.equal((await detail.json()).data.service.details.vat.stage, "FILED");
  const list = await fetch(`${base}/services?limit=10`, { headers });
  const listBody = await list.json();
  assert.equal(list.status, 200);
  assert.equal(listBody.page.limit, 10);
  assert.equal(listBody.data.length, 1);
});
