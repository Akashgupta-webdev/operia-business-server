import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../src/modules/user/models/user.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import ClientVATFiling from "../src/modules/clients/models/clientVATFiling.model.js";
import ClientTAXFiling from "../src/modules/clients/models/clientTAXFiling.model.js";
import { createFilingSchema, updateFilingSchema, validateFilingWrite } from "../src/modules/clients/validators/clientFilingBody.validator.js";
import { saveClientFiling, deleteClientFiling } from "../src/modules/clients/services/clientFilingWrite.service.js";

const payload = { periodStart: "01-2026", periodEnd: "03-2026", input: "100.10", output: "20.00", nextDueDate: "28-04-2026" };

test("all six HTTP routes enforce Admin access and return filing write envelopes", async (t) => {
  const config = {
    accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
    refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
    accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800,
    cookieSecure: false, issuer: "insurance-crm", audience: "insurance-crm-web",
  };
  process.env.AUTH_ACCESS_TOKEN_SECRET = config.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = config.refreshTokenSecret;
  let role = "ADMIN";
  t.mock.method(User, "findById", () => ({ exec: async () => ({ _id: "user-123", role, status: "ACTIVE", version: 0 }) }));
  const company = new ClientCompany({ client: new mongoose.Types.ObjectId(), companyName: "Example" });
  t.mock.method(mongoose.connection, "transaction", async (work) => work({}));
  t.mock.method(ClientCompany, "findById", () => ({ session() { return this; }, exec: async () => company }));
  t.mock.method(company, "save", async () => company);
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const token = issueTokenPair({ id: "user-123", role: "ADMIN" }, "session-123", config);
  const headers = { Cookie: `accessToken=${token.accessToken}`, "Content-Type": "application/json" };
  const base = `http://127.0.0.1:${server.address().port}/api/v1/client`;
  for (const [type, Model] of [["VAT", ClientVATFiling], ["TAX", ClientTAXFiling]]) {
    let filing;
    t.mock.method(Model.prototype, "save", async function saveFiling() {
      await this.validate();
      this.version = (this.version ?? -1) + 1;
      filing = this;
      return this;
    });
    t.mock.method(Model, "findById", () => ({ session() { return this; }, exec: async () => filing }));
    t.mock.method(Model, "findOneAndDelete", () => ({ exec: async () => filing }));
    for (const [action, method, body] of [["create", "POST", payload], ["update", "PATCH", { status: "Paid" }], ["delete", "DELETE", undefined]]) {
      const id = action === "create" ? company.id : filing.id;
      const url = `${base}/${action}Filing${type}/${id}`;
      assert.equal((await fetch(url, { method })).status, 401);
      role = "AGENT";
      assert.equal((await fetch(url, { method, headers })).status, 403);
      role = "ADMIN";
      assert.equal((await fetch(url, { method, headers, body: JSON.stringify({ notes: "not allowed" }) })).status, 422);
      const response = await fetch(url, { method, headers, body: body && JSON.stringify(body) });
      assert.equal(response.status, action === "create" ? 201 : 200);
      const result = await response.json();
      assert.ok(result.meta.correlationId);
      if (action === "delete") assert.deepEqual(result.data, { id: filing.id, deleted: true });
      else {
        assert.equal(result.data.company, company.id);
        assert.equal(result.data.client, String(company.client));
        assert.equal(result.data.payableTax, "80.10");
        assert.equal(response.headers.get("etag"), `"${filing.version}"`);
      }
    }
  }
});

test("filing writes validate required fields, money, periods, dates and the allow-list", () => {
  const result = createFilingSchema.validate(payload);
  assert.equal(result.error, undefined);
  assert.equal(result.value.nextDueDate.toISOString(), "2026-04-28T00:00:00.000Z");
  assert.equal(updateFilingSchema.validate({ status: "Paid" }).error, undefined);
  for (const body of [{}, { notes: "Not allowed" }, { client: "override" }, { input: "1.001" }, { periodStart: "13-2026" }, { filingDate: "31-02-2026" }, { nextDueDate: null }, { status: "paid" }]) {
    assert.ok(updateFilingSchema.validate(body).error);
  }
  assert.ok(createFilingSchema.validate({ status: "Draft" }).error);
  validateFilingWrite("create")({ params: { companyId: "bad" }, body: payload }, {}, (error) => assert.equal(error.status, 422));
  validateFilingWrite("delete")({ params: { id: new mongoose.Types.ObjectId().toString() } }, {}, (error) => assert.equal(error, undefined));
});

for (const [type, Model] of [["VAT", ClientVATFiling], ["TAX", ClientTAXFiling]]) {
  test(`${type} create and patch derive ownership and synchronize only the matching deadline`, async (t) => {
    const company = new ClientCompany({ client: new mongoose.Types.ObjectId(), companyName: "Example",
      complianceDueDate: { nextVATDue: "2026-01-01", nextTAXDue: "2026-02-01" } });
    const session = {};
    const otherField = type === "VAT" ? "nextTAXDue" : "nextVATDue";
    const otherDate = company.complianceDueDate[otherField].toISOString();
    let companySaves = 0;
    t.mock.method(mongoose.connection, "transaction", async (work) => work(session));
    t.mock.method(ClientCompany, "findById", (id) => {
      assert.equal(String(id), company.id);
      return { session(value) { assert.equal(value, session); return this; }, exec: async () => company };
    });
    t.mock.method(Model.prototype, "save", async function saveFiling(options) {
      assert.equal(options.session, session);
      await this.validate();
      return this;
    });
    t.mock.method(company, "save", async (options) => { assert.equal(options.session, session); companySaves += 1; return company; });
    const filing = await saveClientFiling(type, "create", company.id, createFilingSchema.validate(payload).value);
    assert.equal(String(filing.client), String(company.client));
    assert.equal(String(filing.company), company.id);
    assert.equal(company.complianceDueDate[`next${type}Due`].toISOString(), "2026-04-28T00:00:00.000Z");
    assert.equal(company.complianceDueDate[otherField].toISOString(), otherDate);
    t.mock.method(Model, "findById", () => ({ session() { return this; }, exec: async () => filing }));
    await saveClientFiling(type, "update", filing.id, { status: "Paid" });
    assert.equal(companySaves, 1);
    assert.equal(filing.periodStart, "01-2026");
    await saveClientFiling(type, "update", filing.id, { nextDueDate: new Date("2026-07-28") });
    assert.equal(companySaves, 2);
    assert.equal(company.complianceDueDate[`next${type}Due`].toISOString(), "2026-07-28T00:00:00.000Z");
    company.client = new mongoose.Types.ObjectId();
    await assert.rejects(saveClientFiling(type, "update", filing.id, { status: "Draft" }), { code: "FILING_COMPANY_MISMATCH" });
  });

  test(`${type} missing records and deletion use the selected filing collection`, async (t) => {
    const id = new mongoose.Types.ObjectId().toString();
    t.mock.method(mongoose.connection, "transaction", async (work) => work({}));
    t.mock.method(Model, "findById", () => ({ session() { return this; }, exec: async () => null }));
    await assert.rejects(saveClientFiling(type, "update", id, { status: "Paid" }), { code: "CLIENT_FILING_NOT_FOUND" });
    t.mock.method(ClientCompany, "findById", () => ({ session() { return this; }, exec: async () => null }));
    await assert.rejects(saveClientFiling(type, "create", id, payload), { code: "CLIENT_COMPANY_NOT_FOUND" });
    let found = { _id: id };
    t.mock.method(Model, "findOneAndDelete", (filter) => {
      assert.deepEqual(filter, { _id: id });
      return { exec: async () => found };
    });
    assert.deepEqual(await deleteClientFiling(type, id), { id, deleted: true });
    found = null;
    await assert.rejects(deleteClientFiling(type, id), { code: "CLIENT_FILING_NOT_FOUND" });
  });
}
