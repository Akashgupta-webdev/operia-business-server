import { formatClientRenewalRow } from "../src/modules/clients/utils/clientRenewal.utils.js";
import assert from "node:assert/strict";
import test from "node:test";
import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientRoute from "../src/modules/clients/client.route.js";
import User from "../src/modules/user/models/user.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import { buildClientRenewalsPipeline, getClientRenewals } from "../src/modules/clients/services/clientRenewal.service.js";
import { getClientRenewalsQuerySchema } from "../src/modules/clients/validators/clientRenewal.validator.js";

const TOKEN_CONFIG = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  cookieSecure: false,
  issuer: "insurance-crm",
  audience: "insurance-crm-web",
};


test("renewals route precedes the Client id route and validates pagination", () => {
  const paths = ClientRoute.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  assert.ok(paths.indexOf("/renewals") < paths.indexOf("/:id"));
  assert.deepEqual(getClientRenewalsQuerySchema.validate({}).value, { page: 1, limit: 20 });
  assert.deepEqual(getClientRenewalsQuerySchema.validate({ page: "2", limit: "10" }).value, { page: 2, limit: 10 });
  for (const query of [{ page: 0 }, { limit: 101 }, { page: 1.5 }, { search: "x" }, { unknown: true }]) {
    assert.ok(getClientRenewalsQuerySchema.validate(query).error);
  }
});

test("all fourteen expiry mappings are combined before global date sorting and pagination", () => {
  const pipeline = buildClientRenewalsPipeline({ page: 2, limit: 10 });
  const unions = pipeline.filter((stage) => stage.$unionWith).map((stage) => stage.$unionWith);
  assert.deepEqual(unions.map((union) => union.coll), ["clientMembers", "clientCompanies", "clientDocuments", "clientDrivers", "clientVehicles"]);
  const sources = [pipeline, ...unions.map((union) => union.pipeline)];
  const rows = sources.flatMap((stages) => stages[0].$project.renewals);
  assert.equal(rows.length, 14);
  assert.deepEqual(rows.map((row) => row.expiryDate.$ifNull[0]), [
    "$passport.passportExpiryDate", "$emirates.emiratesExpiryDate", "$visa.visaExpiryDate", "$healthInsurance.healthInsuranceExpiryDate",
    "$passport.passportExpiryDate", "$emirates.emiratesExpiryDate", "$visa.visaExpiryDate", "$healthInsurance.healthInsuranceExpiryDate",
    "$establishment.establishmentCardExpiry", "$tradeLicence.tradeLicenceExpiry", "$expiryDate", "$licenceExpiryDate", "$registrationExpiry", "$insuranceExpiry",
  ]);
  for (const stages of sources) {
    assert.equal(stages[2].$set.expirySortDate.$dateFromString.onError, null);
    assert.equal(stages[3].$match.expirySortDate.$ne, null);
    assert.equal(stages[3].$match.$expr.$eq[1].$dateToString.format, "%d-%m-%Y");
  }
  const facet = pipeline.at(-1).$facet;
  assert.deepEqual(facet.data[0].$sort, { expirySortDate: 1, source: 1, recordId: 1, "renewals.category": 1 });
  assert.deepEqual(facet.data.slice(1, 3), [{ $skip: 10 }, { $limit: 10 }]);
  assert.deepEqual(facet.metadata, [{ $count: "total" }]);
  assert.deepEqual(Object.keys(facet.data.at(-1).$project).sort(), ["_id", "category", "clientId", "clientName", "companyNames", "entity", "expiryDate", "id", "item", "recordId", "source"]);
});

test("service returns combined counts and handles empty aggregation results", async (t) => {
  const rows = [{ item: "TL-1", category: "tradeLicence", expiryDate: "31-12-2030" }];
  let result = [{ data: rows, metadata: [{ total: 21 }] }];
  t.mock.method(Client, "aggregate", () => ({ async exec() { return result; } }));
  assert.deepEqual(await getClientRenewals({ page: 2, limit: 20 }), {
    renewals: rows.map(formatClientRenewalRow), page: { page: 2, limit: 20, total: 21, totalPages: 2 },
  });
  result = [];
  assert.deepEqual(await getClientRenewals({ page: 1, limit: 20 }), {
    renewals: [], page: { page: 1, limit: 20, total: 0, totalPages: 0 },
  });
});

test("HTTP renewal listing enforces authentication, role and query validation", async (t) => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;
  let role = "ADMIN";
  let calls = 0;
  t.mock.method(User, "findById", () => ({ async exec() {
    return { _id: { toString: () => "user-123" }, role, status: "ACTIVE", version: 0 };
  } }));
  t.mock.method(Client, "aggregate", () => ({ async exec() {
    calls += 1;
    return [{ data: [], metadata: [] }];
  } }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const url = "http://127.0.0.1:" + server.address().port + "/api/v1/client/renewals";
  const { accessToken } = issueTokenPair({ id: "user-123", role: "ADMIN" }, "session-123", TOKEN_CONFIG);
  const headers = { Cookie: "accessToken=" + accessToken };
  try {
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(url + "?limit=101", { headers })).status, 422);
    role = "AGENT";
    assert.equal((await fetch(url, { headers })).status, 403);
    assert.equal(calls, 0);
    role = "ADMIN";
    const response = await fetch(url + "?page=2&limit=10", { headers });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.page, { page: 2, limit: 10, total: 0, totalPages: 0 });
    assert.ok(body.meta.correlationId);
    assert.equal(calls, 1);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});


test("formats renewal item and entity using names and handles absent companies", () => {
  const row = { category: "visa", entity: "Example Employee", clientName: "Example Client", companyNames: ["Example LLC"] };
  assert.deepEqual(formatClientRenewalRow(row), {
    category: "visa", item: "Visa (Example Employee)",
    entity: "Example Employee - Example LLC", clientName: "Example Client",
  });
  assert.equal(formatClientRenewalRow({ ...row, companyNames: [] }).entity, "Example Employee");
  assert.equal(formatClientRenewalRow({ ...row, entity: null }).item, "Visa (Example Client)");
  assert.equal(formatClientRenewalRow({ ...row, companyNames: ["Example LLC", "Example LLC", "Second LLC"] }).entity, "Example Employee - Example LLC, Second LLC");
  assert.deepEqual(formatClientRenewalRow({ category: "visa", entity: null }), { category: "visa", item: "Visa", entity: null });
});
