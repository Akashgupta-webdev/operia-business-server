import assert from "node:assert/strict";
import test from "node:test";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import ClientRoute from "../src/modules/clients/client.route.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import {
  buildGetClientCompaniesPipeline,
  getClientCompanies,
} from "../src/modules/clients/services/clientCompanyQuery.service.js";
import { getClientCompaniesQuerySchema } from "../src/modules/clients/validators/clientCompanyQuery.validator.js";
import User from "../src/modules/user/models/user.model.js";

const TOKEN_CONFIG = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  cookieSecure: false,
  issuer: "insurance-crm",
  audience: "insurance-crm-web",
};

test("registers GET /companies before the Client detail route", () => {
  const routes = ClientRoute.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));
  const companyIndex = routes.findIndex(
    ({ path, methods }) => path === "/companies" && methods.get
  );
  const clientDetailIndex = routes.findIndex(
    ({ path, methods }) => path === "/:id" && methods.get
  );

  assert.ok(companyIndex >= 0);
  assert.ok(companyIndex < clientDetailIndex);
});

test("validates Company list pagination and search", () => {
  const defaults = getClientCompaniesQuerySchema.validate({});
  const normalized = getClientCompaniesQuerySchema.validate({
    page: "2",
    limit: "10",
    search: "  Example LLC  ",
  });
  const invalid = getClientCompaniesQuerySchema.validate(
    { page: 0, limit: 101, search: "", status: "Active" },
    { abortEarly: false }
  );

  assert.deepEqual(defaults.value, { page: 1, limit: 20 });
  assert.deepEqual(normalized.value, {
    page: 2,
    limit: 10,
    search: "Example LLC",
  });
  assert.deepEqual(
    invalid.error.details.map((detail) => detail.path.join(".")).sort(),
    ["limit", "page", "search", "status"]
  );
});

test("builds escaped Company search, Client join, and paginated projection", () => {
  const pipeline = buildGetClientCompaniesPipeline({
    page: 2,
    limit: 10,
    search: "Example.",
  });

  assert.equal(pipeline[0].$match.companyName.source, "Example\\.");
  assert.equal(pipeline[1].$lookup.from, "clients");
  assert.equal(pipeline[2].$unwind.preserveNullAndEmptyArrays, true);

  const facet = pipeline.at(-1).$facet;
  assert.deepEqual(facet.data[0], { $sort: { createdAt: -1, _id: 1 } });
  assert.deepEqual(facet.data[1], { $skip: 10 });
  assert.deepEqual(facet.data[2], { $limit: 10 });
  assert.ok(facet.data[3].$project.clientName);
  assert.ok(facet.data[3].$project.clientStatus);
  assert.ok(facet.data[3].$project.corporateTaxNumber);
  assert.ok(facet.data[3].$project.createdAt);
  assert.ok(facet.data[3].$project.nationality);
  assert.deepEqual(facet.metadata, [{ $count: "total" }]);
});

test("returns Company rows with calculated page metadata", async () => {
  const originalAggregate = ClientCompany.aggregate;
  let capturedCollation;
  const companies = [
    {
      id: "68ad00000000000000000002",
      client: "68ad00000000000000000001",
      companyName: "Example LLC",
      clientName: "Example Person",
      clientStatus: "Active",
      corporateTaxNumber: "CT-1001",
      nationality: "India",
      createdAt: new Date("2026-08-30T10:00:00.000Z"),
    },
  ];

  ClientCompany.aggregate = () => ({
    collation(value) {
      capturedCollation = value;
      return this;
    },
    async exec() {
      return [{ data: companies, metadata: [{ total: 21 }] }];
    },
  });

  try {
    const result = await getClientCompanies({ page: 2, limit: 20 });

    assert.deepEqual(capturedCollation, { locale: "en", strength: 2 });
    assert.deepEqual(result.companies, companies);
    assert.deepEqual(result.page, {
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
  } finally {
    ClientCompany.aggregate = originalAggregate;
  }
});

test("serves the validated Client Company list route", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const originalUserFindById = User.findById;
  const originalAggregate = ClientCompany.aggregate;
  User.findById = () => ({
    async exec() {
      return {
        _id: { toString: () => "user-123" },
        role: "ADMIN",
        status: "ACTIVE",
        version: 0,
      };
    },
  });
  ClientCompany.aggregate = () => ({
    collation() {
      return this;
    },
    async exec() {
      return [{ data: [], metadata: [] }];
    },
  });

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { accessToken } = issueTokenPair(
    { id: "user-123", role: "ADMIN" },
    "session-123",
    TOKEN_CONFIG
  );

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/client/companies?search=Example&page=1&limit=10`,
      { headers: { Cookie: `accessToken=${accessToken}` } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.page, {
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  } finally {
    User.findById = originalUserFindById;
    ClientCompany.aggregate = originalAggregate;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
