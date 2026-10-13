import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import User from "../src/modules/user/models/user.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import { buildGetClientsPipeline } from "../src/modules/clients/services/clientQuery.service.js";
import { clientComplianceBodySchema } from "../src/modules/clients/validators/clientCompliance.validator.js";

test("compliance defaults and membership payload allow-list", () => {
  assert.equal(new Client().complianceService, false);
  assert.equal(new Client({ complianceService: true }).complianceService, true);
  for (const body of [undefined, {}, { _id: "bad" }, { _id: "68ad00000000000000000001", complianceService: true }]) {
    assert.ok(clientComplianceBodySchema.validate(body).error);
  }
  assert.equal(clientComplianceBodySchema.validate({ _id: "68ad00000000000000000001" }).error, undefined);
});

test("compliance lists preserve legacy defaults, literal name search and minimal projections", () => {
  for (const complianceService of [false, true]) {
    const pipeline = buildGetClientsPipeline({ page: 2, limit: 5, search: "Example.*" }, { complianceService });
    assert.deepEqual(pipeline[0].$match, complianceService ? { complianceService: true } : {
      $or: [{ complianceService: false }, { complianceService: { $exists: false } }],
    });
    assert.deepEqual(pipeline.filter((stage) => stage.$lookup).map((stage) => stage.$lookup.from), ["clientCompanies"]);
    const search = pipeline[2].$match.$or;
    assert.deepEqual(search.map((field) => Object.keys(field)[0]), ["name", "companies.companyName"]);
    assert.equal(search[0].name.test("Example anything"), false);
    assert.equal(search[0].name.test("EXAMPLE.*"), true);
    const facet = pipeline.at(-1).$facet;
    assert.deepEqual(facet.data[1], { $skip: 5 });
    assert.deepEqual(Object.keys(facet.data.at(-1).$project).sort(), ["_id", "companyName", "mobileNumber", "name", "nationality"]);
    assert.deepEqual(facet.metadata, [{ $count: "total" }]);
  }
});

test("compliance HTTP routes enforce authorization, validation, membership updates and errors", async (t) => {
  const config = {
    accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
    refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
    accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800,
    cookieSecure: false, issuer: "insurance-crm", audience: "insurance-crm-web",
  };
  process.env.AUTH_ACCESS_TOKEN_SECRET = config.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = config.refreshTokenSecret;
  let role = "ADMIN";
  let exists = true;
  let failList = false;
  const client = new Client({ _id: "68ad00000000000000000001", version: 0 });
  t.mock.method(User, "findById", () => ({ exec: async () => ({
    _id: "user-123", role, status: "ACTIVE", version: 0,
  }) }));
  t.mock.method(Client, "findById", () => ({ exec: async () => exists ? client : null }));
  t.mock.method(client, "save", async () => { client.version += 1; return client; });
  t.mock.method(Client, "aggregate", () => ({
    collation() { return this; },
    async exec() {
      if (failList) throw new Error("private database failure");
      return [{ data: [], metadata: [] }];
    },
  }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/v1/client/`;
  const tokens = issueTokenPair({ id: "user-123", role: "ADMIN" }, "session-123", config);
  const headers = { Cookie: `accessToken=${tokens.accessToken}`, "Content-Type": "application/json" };
  for (const route of ["getClientForAddingInComplianceService", "getClientAddedInComplianceService"]) {
    assert.equal((await fetch(base + route)).status, 401);
    const response = await fetch(base + route, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.page, { page: 1, limit: 20, total: 0, totalPages: 0 });
    assert.ok(body.meta.correlationId);
    if (route === "getClientAddedInComplianceService") {
      assert.deepEqual(body.metrics, { totalTaxFilings: 0, actionRequired: 0 });
    } else {
      assert.equal(body.metrics, undefined);
    }
    assert.equal((await fetch(base + route + "?page=0&limit=101", { headers })).status, 422);
    role = "AGENT";
    assert.equal((await fetch(base + route, { headers })).status, 403);
    role = "ADMIN";
  }
  for (const [route, target] of [["AddClientInComplianceService", true], ["RemoveClientFromComplianceService", false]]) {
    const request = { method: "PATCH", headers, body: JSON.stringify({ _id: client._id.toString() }) };
    assert.equal((await fetch(base + route, { ...request, headers: { "Content-Type": "application/json" } })).status, 401);
    role = "AGENT";
    assert.equal((await fetch(base + route, request)).status, 403);
    role = "ADMIN";
    for (let repeat = 0; repeat < 2; repeat += 1) {
      const response = await fetch(base + route, request);
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).data, { _id: client._id.toString(), complianceService: target });
      assert.ok(response.headers.get("ETag"));
    }
    assert.equal((await fetch(base + route, { ...request, body: '{"_id":"bad"}' })).status, 422);
    exists = false;
    const missing = await fetch(base + route, request);
    assert.equal(missing.status, 404);
    assert.equal((await missing.json()).error.code, "CLIENT_NOT_FOUND");
    exists = true;
  }
  failList = true;
  const failed = await fetch(base + "getClientAddedInComplianceService", { headers });
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error.message, "An unexpected error occurred.");
});
