import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Client from "../src/modules/clients/models/client.model.js";
import Company from "../src/modules/company/models/company.model.js";
import User from "../src/modules/user/models/user.model.js";

const tokenConfig = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  cookieSecure: false,
  issuer: "insurance-crm",
  audience: "insurance-crm-web",
};

const clientObjectId = "507f1f77bcf86cd799439011";
let baseUrl;
let server;

before(async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = tokenConfig.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = tokenConfig.refreshTokenSecret;

  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

const queryReturning = (value) => ({
  async exec() {
    return value;
  },
});

const authenticatedCookie = (role) => {
  const tokens = issueTokenPair(
    { id: "user-123", role },
    "session-123",
    tokenConfig
  );
  return `accessToken=${tokens.accessToken}`;
};

const mockAuthenticatedUser = (role) => {
  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: `${role} Name`,
      email: `${role.toLowerCase()}@example.test`,
      role,
      status: "ACTIVE",
      version: 0,
    });
};

test("requires authentication before creating a company", async () => {
  const response = await fetch(`${baseUrl}/api/v1/companies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("allows only Admin users to create a company", async () => {
  const originalFindById = User.findById;
  mockAuthenticatedUser("AGENT");

  try {
    const response = await fetch(`${baseUrl}/api/v1/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("AGENT"),
      },
      body: JSON.stringify({
        client: clientObjectId,
        companyName: "Example Company",
        companyType: "MAINLAND",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, "FORBIDDEN");
  } finally {
    User.findById = originalFindById;
  }
});

test("validates required company fields and rejects unknown fields", async () => {
  const originalFindById = User.findById;
  mockAuthenticatedUser("ADMIN");

  try {
    const response = await fetch(`${baseUrl}/api/v1/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("ADMIN"),
      },
      body: JSON.stringify({ unexpected: true }),
    });
    const body = await response.json();
    const fields = body.error.details.map((detail) => detail.field);

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.ok(fields.includes("client"));
    assert.ok(fields.includes("companyName"));
    assert.ok(fields.includes("companyType"));
    assert.ok(fields.includes("unexpected"));
  } finally {
    User.findById = originalFindById;
  }
});

test("returns CLIENT_NOT_FOUND for a missing referenced Client", async () => {
  const originalFindById = User.findById;
  const originalExists = Client.exists;
  mockAuthenticatedUser("ADMIN");
  Client.exists = () => queryReturning(null);

  try {
    const response = await fetch(`${baseUrl}/api/v1/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("ADMIN"),
      },
      body: JSON.stringify({
        client: clientObjectId,
        companyName: "Example Company",
        companyType: "MAINLAND",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "CLIENT_NOT_FOUND");
  } finally {
    User.findById = originalFindById;
    Client.exists = originalExists;
  }
});

test("creates a validated company for an Admin", async () => {
  const originalFindById = User.findById;
  const originalExists = Client.exists;
  const originalCreate = Company.create;
  let createPayload;

  mockAuthenticatedUser("ADMIN");
  Client.exists = () => queryReturning({ _id: clientObjectId });
  Company.create = async (payload) => {
    createPayload = payload;
    return {
      ...payload,
      companyId: "comp-1001",
      companyStatus: payload.companyStatus ?? "ACTIVE",
      version: 0,
    };
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("ADMIN"),
      },
      body: JSON.stringify({
        client: clientObjectId,
        companyName: "  Example Company  ",
        companyType: "FREE_ZONE",
        freeZoneName: "Example Free Zone",
        companyEmail: "INFO@EXAMPLE.TEST",
        iban: "ae070331234567890123456",
        notes: [" First note "],
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("location"), "/api/v1/companies/comp-1001");
    assert.equal(response.headers.get("etag"), '"0"');
    assert.equal(createPayload.companyName, "Example Company");
    assert.equal(createPayload.companyEmail, "info@example.test");
    assert.equal(createPayload.iban, "AE070331234567890123456");
    assert.deepEqual(createPayload.notes, ["First note"]);
    assert.equal(body.data.companyId, "comp-1001");
    assert.equal(
      body.meta.correlationId,
      response.headers.get("x-correlation-id")
    );
  } finally {
    User.findById = originalFindById;
    Client.exists = originalExists;
    Company.create = originalCreate;
  }
});

test("rejects an invalid Client ID when listing companies", async () => {
  const originalFindById = User.findById;
  mockAuthenticatedUser("ADMIN");

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/companies/client/not-an-object-id`,
      { headers: { Cookie: authenticatedCookie("ADMIN") } }
    );
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.equal(body.error.details[0].field, "clientId");
  } finally {
    User.findById = originalFindById;
  }
});

test("returns paginated companies belonging to a Client", async () => {
  const originalFindById = User.findById;
  const originalExists = Client.exists;
  const originalFind = Company.find;
  const originalCountDocuments = Company.countDocuments;
  let companyFilter;
  let countFilter;
  let sortFields;
  let skipped;
  let limited;

  mockAuthenticatedUser("ADMIN");
  Client.exists = () => queryReturning({ _id: clientObjectId });
  Company.find = (filter) => {
    companyFilter = filter;
    return {
      sort(fields) {
        sortFields = fields;
        return this;
      },
      skip(value) {
        skipped = value;
        return this;
      },
      limit(value) {
        limited = value;
        return this;
      },
      lean() {
        return this;
      },
      async exec() {
        return [
          {
            _id: { toString: () => "company-mongo-id" },
            client: { toString: () => clientObjectId },
            companyId: "comp-1001",
            companyName: "Example Company",
            companyType: "MAINLAND",
            companyStatus: "ACTIVE",
            notes: [],
            version: 0,
          },
        ];
      },
    };
  };
  Company.countDocuments = (filter) => {
    countFilter = filter;
    return queryReturning(3);
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/companies/client/${clientObjectId}?page=2&limit=1`,
      { headers: { Cookie: authenticatedCookie("ADMIN") } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(companyFilter, { client: clientObjectId });
    assert.deepEqual(countFilter, { client: clientObjectId });
    assert.deepEqual(sortFields, { createdAt: -1, companyId: 1 });
    assert.equal(skipped, 1);
    assert.equal(limited, 1);
    assert.deepEqual(body.data, [
      {
        id: "company-mongo-id",
        client: clientObjectId,
        companyId: "comp-1001",
        companyName: "Example Company",
        companyType: "MAINLAND",
        companyStatus: "ACTIVE",
        notes: [],
        version: 0,
      },
    ]);
    assert.deepEqual(body.page, {
      page: 2,
      limit: 1,
      total: 3,
      totalPages: 3,
    });
    assert.equal(
      body.meta.correlationId,
      response.headers.get("x-correlation-id")
    );
  } finally {
    User.findById = originalFindById;
    Client.exists = originalExists;
    Company.find = originalFind;
    Company.countDocuments = originalCountDocuments;
  }
});

test("returns an empty company list for a Client without companies", async () => {
  const originalFindById = User.findById;
  const originalExists = Client.exists;
  const originalFind = Company.find;
  const originalCountDocuments = Company.countDocuments;

  mockAuthenticatedUser("ADMIN");
  Client.exists = () => queryReturning({ _id: clientObjectId });
  Company.find = () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    lean() {
      return this;
    },
    async exec() {
      return [];
    },
  });
  Company.countDocuments = () => queryReturning(0);

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/companies/client/${clientObjectId}`,
      { headers: { Cookie: authenticatedCookie("ADMIN") } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, []);
    assert.deepEqual(body.page, {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });
  } finally {
    User.findById = originalFindById;
    Client.exists = originalExists;
    Company.find = originalFind;
    Company.countDocuments = originalCountDocuments;
  }
});
