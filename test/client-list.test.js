import assert from "node:assert/strict";
import test from "node:test";

import Client from "../src/modules/clients/models/client.model.js";
import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import {
  buildGetClientsPipeline,
  getClients,
} from "../src/modules/clients/services/clientQuery.service.js";
import { getClientsQuerySchema } from "../src/modules/clients/validators/clientQuery.validator.js";
import User from "../src/modules/user/models/user.model.js";

test("applies the documented Client list defaults", () => {
  const { error, value } = getClientsQuerySchema.validate({});

  assert.equal(error, undefined);
  assert.deepEqual(value, {
    page: 1,
    limit: 20,
    sort: "Newest First",
  });
});

test("rejects invalid Client list filters and unknown fields", () => {
  const { error } = getClientsQuerySchema.validate(
    {
      page: 0,
      limit: 101,
      status: "ACTIVE",
      clientType: "PERSON",
      sort: "Newest",
      unknown: "value",
    },
    { abortEarly: false }
  );
  const fields = error.details.map((detail) => detail.path.join(".")).sort();

  assert.deepEqual(fields, [
    "clientType",
    "limit",
    "page",
    "sort",
    "status",
    "unknown",
  ]);
});

test("builds filtered search, joined counts, sorting, and pagination in one pipeline", () => {
  const pipeline = buildGetClientsPipeline({
    search: "Example.",
    page: 2,
    limit: 10,
    status: "Active",
    clientType: "COMPANY",
    sort: "Name(A-Z)",
  });

  assert.deepEqual(pipeline[0], {
    $match: { status: "Active", clientType: "COMPANY" },
  });

  const lookups = pipeline.filter((stage) => stage.$lookup);
  assert.deepEqual(
    lookups.map((stage) => stage.$lookup.from),
    ["clientCompanies", "clientServices", "clientDocuments"]
  );

  const searchStage = pipeline.find((stage) => stage.$match?.$or);
  assert.equal(searchStage.$match.$or.length, 5);
  assert.equal(searchStage.$match.$or[0].name.source, "Example\\.");
  assert.equal(
    searchStage.$match.$or[4]["companies.companyName"].source,
    "Example\\."
  );

  const facet = pipeline.at(-1).$facet;
  assert.deepEqual(facet.data[0], { $sort: { name: 1, _id: 1 } });
  assert.deepEqual(facet.data[1], { $skip: 10 });
  assert.deepEqual(facet.data[2], { $limit: 10 });
  assert.ok(facet.data[3].$project.companyCount);
  assert.ok(facet.data[3].$project.serviceCount);
  assert.ok(facet.data[3].$project.documentCount);
  assert.deepEqual(facet.metadata, [{ $count: "total" }]);
});

test("returns Client rows with calculated pagination metadata", async () => {
  const originalAggregate = Client.aggregate;
  let capturedPipeline;
  let capturedCollation;
  const clients = [
    {
      _id: "68ad00000000000000000001",
      name: "Example Person",
      clientType: "COMPANY",
      mobileNumber: "+971501234567",
      emailAddress: "person@example.test",
      nationality: "India",
      status: "Active",
      companyName: "Example LLC",
      companyCount: 2,
      serviceCount: 3,
      documentCount: 4,
    },
  ];

  Client.aggregate = (pipeline) => {
    capturedPipeline = pipeline;
    return {
      collation(value) {
        capturedCollation = value;
        return this;
      },
      async exec() {
        return [{ data: clients, metadata: [{ total: 21 }] }];
      },
    };
  };

  try {
    const result = await getClients({
      page: 2,
      limit: 20,
      sort: "Newest First",
    });

    assert.ok(capturedPipeline.at(-1).$facet);
    assert.deepEqual(capturedCollation, { locale: "en", strength: 2 });
    assert.deepEqual(result.clients, clients);
    assert.deepEqual(result.page, {
      page: 2,
      limit: 20,
      total: 21,
      totalPages: 2,
    });
  } finally {
    Client.aggregate = originalAggregate;
  }
});

test("serves the validated Client list through GET /api/v1/client", async () => {
  const tokenConfig = {
    accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
    refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
    accessTokenTtlSeconds: 900,
    refreshTokenTtlSeconds: 604800,
    cookieSecure: false,
    issuer: "insurance-crm",
    audience: "insurance-crm-web",
  };
  process.env.AUTH_ACCESS_TOKEN_SECRET = tokenConfig.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = tokenConfig.refreshTokenSecret;

  const originalFindById = User.findById;
  const originalAggregate = Client.aggregate;
  User.findById = () => ({
    async exec() {
      return {
        _id: { toString: () => "user-123" },
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
        status: "ACTIVE",
        version: 0,
      };
    },
  });
  Client.aggregate = () => ({
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
  const tokens = issueTokenPair(
    { id: "user-123", role: "ADMIN" },
    "session-123",
    tokenConfig
  );

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/client`,
      { headers: { Cookie: `accessToken=${tokens.accessToken}` } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.page, {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
    });
  } finally {
    User.findById = originalFindById;
    Client.aggregate = originalAggregate;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
