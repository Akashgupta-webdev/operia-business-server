import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
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
  const tokens = issueTokenPair({ id: "user-123", role }, "session-123", tokenConfig);
  return `accessToken=${tokens.accessToken}`;
};

test("requires authentication before creating a client", async () => {
  const response = await fetch(`${baseUrl}/api/v1/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error.code, "AUTHENTICATION_REQUIRED");
});

test("validates the multipart Client Service package", async () => {
  const originalFindById = User.findById;
  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });
  const form = new FormData();
  form.set(
    "payload",
    JSON.stringify({
      client: { clientType: "INDIVIDUAL", name: "Incomplete Client" },
      service: {},
    })
  );

  try {
    const response = await fetch(`${baseUrl}/api/v1/clients/with-service`, {
      method: "POST",
      headers: { Cookie: authenticatedCookie("ADMIN") },
      body: form,
    });
    const body = await response.json();
    const fields = body.error.details.map(({ field }) => field);

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.ok(fields.includes("client.mobileNumber"));
    assert.ok(fields.includes("client.emailAddress"));
    assert.ok(fields.includes("service.category"));
  } finally {
    User.findById = originalFindById;
  }
});

test("validates Client Service lookup parameters", async () => {
  const originalFindById = User.findById;
  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients/client-1/with-service/not-an-object-id`,
      { headers: { Cookie: authenticatedCookie("ADMIN") } }
    );
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.equal(body.error.details[0].field, "serviceId");
  } finally {
    User.findById = originalFindById;
  }
});

test("allows only Admin users to create clients", async () => {
  const originalFindById = User.findById;
  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Agent Name",
      email: "agent@example.test",
      role: "AGENT",
      status: "ACTIVE",
      version: 0,
    });

  try {
    const response = await fetch(`${baseUrl}/api/v1/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("AGENT"),
      },
      body: JSON.stringify({
        name: "Example Client",
        mobileNumber: "+971501234567",
        preferredCommunicationMethod: "CALL",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error.code, "FORBIDDEN");
  } finally {
    User.findById = originalFindById;
  }
});

test("requires at least one client contact method", async () => {
  const originalFindById = User.findById;
  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });

  try {
    const response = await fetch(`${baseUrl}/api/v1/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("ADMIN"),
      },
      body: JSON.stringify({
        name: "Example Client",
        preferredCommunicationMethod: "EMAIL",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.equal(
      body.error.details[0].field,
      "mobileNumber|whatsappNumber|emailAddress"
    );
  } finally {
    User.findById = originalFindById;
  }
});

test("creates a validated client for an Admin user", async () => {
  const originalFindById = User.findById;
  const originalCreate = Client.create;
  let createPayload;

  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });
  Client.create = async (payload) => {
    createPayload = payload;
    return {
      ...payload,
      clientId: "client-123",
      clientStatus: payload.clientStatus ?? "ACTIVE",
      version: 0,
    };
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/clients`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("ADMIN"),
      },
      body: JSON.stringify({
        name: "  Example Client  ",
        emailAddress: "CLIENT@EXAMPLE.TEST",
        nationality: "Emirati",
        preferredCommunicationMethod: "EMAIL",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("location"), "/api/v1/clients/client-123");
    assert.equal(response.headers.get("etag"), '"0"');
    assert.equal(createPayload.name, "Example Client");
    assert.equal(createPayload.emailAddress, "client@example.test");
    assert.equal(body.data.clientId, "client-123");
    assert.equal(
      body.meta.correlationId,
      response.headers.get("x-correlation-id")
    );
  } finally {
    User.findById = originalFindById;
    Client.create = originalCreate;
  }
});

test("enforces required contact and preferred method in the Client model", async () => {
  const invalidClient = new Client({
    name: "Example Client",
  });
  const invalidError = await invalidClient
    .validate()
    .catch((error) => error);

  assert.ok(invalidError.errors.mobileNumber);
  assert.ok(invalidError.errors.preferredCommunicationMethod);

  const validClient = new Client({
    name: "Example Client",
    whatsappNumber: "+971501234567",
    preferredCommunicationMethod: "WHATSAPP",
  });

  await validClient.validate();
  assert.equal(validClient.clientType, "INDIVIDUAL");
  assert.equal(validClient.clientStatus, "ACTIVE");
});

test("returns only the requested client summary fields for an Admin", async () => {
  const originalUserFindById = User.findById;
  const originalClientFindOne = Client.findOne;
  let lookupFilter;
  let selectedFields;

  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });
  Client.findOne = (filter) => {
    lookupFilter = filter;
    return {
      select(fields) {
        selectedFields = fields;
        return this;
      },
      lean() {
        return this;
      },
      async exec() {
        return {
          clientId: "client-123",
          name: "Example Client",
          emiratesIdNumber: "784-1234-1234567-1",
          emailAddress: "client@example.test",
          mobileNumber: "+971501234567",
          clientStatus: "ACTIVE",
          passportNumber: "NOT-EXPOSED",
          notes: "NOT-EXPOSED",
        };
      },
    };
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients/client-123`,
      {
        headers: { Cookie: authenticatedCookie("ADMIN") },
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(lookupFilter, { clientId: "client-123" });
    assert.match(selectedFields, /name/);
    assert.deepEqual(body.data, {
      clientId: "client-123",
      name: "Example Client",
      emiratesIdNumber: "784-1234-1234567-1",
      emailAddress: "client@example.test",
      mobileNumber: "+971501234567",
      whatsappNumber: null,
      clientStatus: "ACTIVE",
    });
    assert.equal(body.data.passportNumber, undefined);
    assert.equal(body.data.notes, undefined);
  } finally {
    User.findById = originalUserFindById;
    Client.findOne = originalClientFindOne;
  }
});

test("returns a safe not-found response for an unknown client", async () => {
  const originalUserFindById = User.findById;
  const originalClientFindOne = Client.findOne;

  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });
  Client.findOne = () => ({
    select() {
      return this;
    },
    lean() {
      return this;
    },
    async exec() {
      return null;
    },
  });

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients/missing-client`,
      {
        headers: { Cookie: authenticatedCookie("ADMIN") },
      }
    );
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error.code, "CLIENT_NOT_FOUND");
    assert.equal(body.error.message, "Client was not found.");
  } finally {
    User.findById = originalUserFindById;
    Client.findOne = originalClientFindOne;
  }
});

test("returns a searched and paginated client list for an Admin", async () => {
  const originalUserFindById = User.findById;
  const originalClientFind = Client.find;
  const originalCountDocuments = Client.countDocuments;
  let listFilter;
  let countFilter;
  let selectedFields;
  let sortFields;
  let skipped;
  let limited;

  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });
  Client.find = (filter) => {
    listFilter = filter;
    return {
      select(fields) {
        selectedFields = fields;
        return this;
      },
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
            clientId: "client-123",
            name: "John. Smith",
            emailAddress: "john@example.test",
            clientStatus: "ACTIVE",
            passportNumber: "NOT-EXPOSED",
          },
        ];
      },
    };
  };
  Client.countDocuments = (filter) => {
    countFilter = filter;
    return queryReturning(5);
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients?page=2&limit=2&search=John.`,
      {
        headers: { Cookie: authenticatedCookie("ADMIN") },
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(listFilter, countFilter);
    assert.equal(listFilter.$or.length, 5);
    assert.equal(listFilter.$or[0].name.source, "John\\.");
    assert.equal(listFilter.$or[0].name.flags, "i");
    assert.match(selectedFields, /clientStatus/);
    assert.deepEqual(sortFields, { createdAt: -1, clientId: 1 });
    assert.equal(skipped, 2);
    assert.equal(limited, 2);
    assert.deepEqual(body.page, {
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    assert.deepEqual(body.data, [
      {
        clientId: "client-123",
        name: "John. Smith",
        emiratesIdNumber: null,
        emailAddress: "john@example.test",
        mobileNumber: null,
        whatsappNumber: null,
        clientStatus: "ACTIVE",
      },
    ]);
    assert.equal(body.data[0].passportNumber, undefined);
  } finally {
    User.findById = originalUserFindById;
    Client.find = originalClientFind;
    Client.countDocuments = originalCountDocuments;
  }
});

test("rejects invalid client list query values", async () => {
  const originalUserFindById = User.findById;

  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients?page=0&limit=101&unknown=value`,
      {
        headers: { Cookie: authenticatedCookie("ADMIN") },
      }
    );
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.deepEqual(
      body.error.details.map(({ field }) => field).sort(),
      ["limit", "page", "unknown"]
    );
  } finally {
    User.findById = originalUserFindById;
  }
});
