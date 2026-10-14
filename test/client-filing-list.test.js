import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientVATFiling from "../src/modules/clients/models/clientVATFiling.model.js";
import ClientTAXFiling from "../src/modules/clients/models/clientTAXFiling.model.js";
import User from "../src/modules/user/models/user.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";

test("VAT and TAX filing routes enforce client scope, pagination, serialization and access", async (t) => {
  const config = {
    accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
    refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
    accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800,
    cookieSecure: false, issuer: "insurance-crm", audience: "insurance-crm-web",
  };
  process.env.AUTH_ACCESS_TOKEN_SECRET = config.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = config.refreshTokenSecret;
  const id = "68ad00000000000000000001";
  let role = "ADMIN";
  let exists = true;
  let total = 3;
  let fail = false;
  const calls = [];
  t.mock.method(User, "findById", () => ({ exec: async () => ({
    _id: "user-123", role, status: "ACTIVE", version: 0,
  }) }));
  t.mock.method(Client, "exists", async (filter) => {
    assert.deepEqual(filter, { _id: id });
    return exists ? { _id: id } : null;
  });
  for (const Model of [ClientVATFiling, ClientTAXFiling]) {
    t.mock.method(Model, "find", (filter) => {
      assert.deepEqual(filter, { client: id });
      calls.push(Model.modelName);
      let skip;
      let limit;
      return {
        sort(order) { assert.deepEqual(order, { filingDate: -1, _id: -1 }); return this; },
        skip(value) { skip = value; return this; },
        limit(value) { limit = value; return this; },
        async exec() {
          if (fail) throw new Error("private database error");
          assert.ok(limit >= 1 && limit <= 100);
          return skip >= total ? [] : [new Model({ client: id, input: "0.30", output: "0.20" })];
        },
      };
    });
    t.mock.method(Model, "countDocuments", (filter) => {
      assert.deepEqual(filter, { client: id });
      return { exec: async () => total };
    });
  }
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const tokens = issueTokenPair({ id: "user-123", role: "ADMIN" }, "session-123", config);
  const headers = { Cookie: `accessToken=${tokens.accessToken}` };
  const base = `http://127.0.0.1:${server.address().port}/api/v1/client`;
  for (const [route, model] of [["vat-filings", "ClientVATFiling"], ["tax-filings", "ClientTAXFiling"]]) {
    const url = `${base}/${id}/${route}`;
    assert.equal((await fetch(url)).status, 401);
    role = "AGENT";
    assert.equal((await fetch(url, { headers })).status, 403);
    role = "ADMIN";
    for (const query of ["page=0", "page=1.5", "limit=101", "limit=0", "search=x", "page=abc"]) {
      assert.equal((await fetch(`${url}?${query}`, { headers })).status, 422);
    }
    assert.equal((await fetch(`${base}/bad/${route}`, { headers })).status, 422);
    total = 3;
    const response = await fetch(url, { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(calls.at(-1), model);
    assert.equal(body.data[0].payableTax, "0.10");
    assert.deepEqual(body.page, { page: 1, limit: 20, total: 3, totalPages: 1 });
    assert.ok(body.meta.correlationId);
    const lastPage = await (await fetch(`${url}?page=3&limit=1`, { headers })).json();
    assert.equal(lastPage.data.length, 1);
    assert.deepEqual(lastPage.page, { page: 3, limit: 1, total: 3, totalPages: 3 });
    const beyond = await (await fetch(`${url}?page=4&limit=1`, { headers })).json();
    assert.deepEqual(beyond.data, []);
    assert.equal(beyond.page.total, 3);
    total = 0;
    const empty = await (await fetch(url, { headers })).json();
    assert.deepEqual(empty.data, []);
    assert.equal(empty.page.totalPages, 0);
    exists = false;
    assert.equal((await fetch(url, { headers })).status, 404);
    exists = true;
    fail = true;
    const failure = await fetch(url, { headers });
    assert.equal(failure.status, 500);
    assert.equal((await failure.text()).includes("private database error"), false);
    fail = false;
  }
});
