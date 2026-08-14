import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import mongoose from "mongoose";

import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import Payment from "../src/modules/common/models/payment.model.js";
import Service from "../src/modules/common/models/service.model.js";
import Company from "../src/modules/company/models/company.model.js";
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

test("lists paginated Services using the Client MongoDB _id", async () => {
  const originalUserFindById = User.findById;
  const originalClientExists = Client.exists;
  const originalServiceFind = Service.find;
  const originalServiceCountDocuments = Service.countDocuments;
  const originalCompanyFind = Company.find;
  const originalPaymentFind = Payment.find;
  const clientMongoId = new mongoose.Types.ObjectId();
  const serviceMongoId = new mongoose.Types.ObjectId();
  const companyMongoId = new mongoose.Types.ObjectId();
  const latestPaymentMongoId = new mongoose.Types.ObjectId();
  const olderPaymentMongoId = new mongoose.Types.ObjectId();
  let serviceFilter;
  let serviceSort;
  let companyFilter;
  let paymentFilter;
  let paymentSort;
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
  Client.exists = async (filter) => {
    assert.deepEqual(filter, { _id: clientMongoId.toString() });
    return { _id: clientMongoId };
  };
  Service.find = (filter) => {
    serviceFilter = filter;
    return {
      sort(value) {
        serviceSort = value;
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
            _id: serviceMongoId,
            client: clientMongoId,
            company: companyMongoId,
            category: "VAT_REGISTRATION",
            status: "NOT_STARTED",
            detail: { applicationType: "New" },
            version: 0,
          },
        ];
      },
    };
  };
  Service.countDocuments = (filter) => {
    assert.equal(filter, serviceFilter);
    return queryReturning(3);
  };
  Company.find = (filter) => {
    companyFilter = filter;
    return {
      lean() {
        return this;
      },
      async exec() {
        return [
          {
            _id: companyMongoId,
            client: clientMongoId,
            companyId: "comp-1001",
            companyName: "Example Company",
            companyType: "MAINLAND",
            companyStatus: "ACTIVE",
          },
        ];
      },
    };
  };
  Payment.find = (filter) => {
    paymentFilter = filter;
    return {
      sort(value) {
        paymentSort = value;
        return this;
      },
      lean() {
        return this;
      },
      async exec() {
        return [
          {
            _id: latestPaymentMongoId,
            company: companyMongoId,
            service: serviceMongoId,
            totalAmount: "150.00",
            paymentDate: new Date("2026-08-15T10:30:00.000Z"),
            paymentStatus: "PAID",
          },
          {
            _id: olderPaymentMongoId,
            company: companyMongoId,
            service: serviceMongoId,
            totalAmount: "100.00",
            paymentDate: new Date("2026-08-14T10:30:00.000Z"),
            paymentStatus: "PARTIAL",
          },
        ];
      },
    };
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients/${clientMongoId}/services?page=2&limit=2`,
      { headers: { Cookie: authenticatedCookie("ADMIN") } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(serviceFilter, { client: clientMongoId.toString() });
    assert.deepEqual(serviceSort, { createdAt: -1, _id: 1 });
    assert.deepEqual(companyFilter, {
      _id: { $in: [companyMongoId.toString()] },
      client: clientMongoId.toString(),
    });
    assert.deepEqual(paymentFilter, {
      service: { $in: [serviceMongoId] },
    });
    assert.deepEqual(paymentSort, { paymentDate: -1, _id: 1 });
    assert.equal(skipped, 2);
    assert.equal(limited, 2);
    assert.equal(body.data[0].id, serviceMongoId.toString());
    assert.equal(body.data[0]._id, undefined);
    assert.equal(body.data[0].company.id, companyMongoId.toString());
    assert.equal(body.data[0].company.companyName, "Example Company");
    assert.equal(body.data[0].payment.id, latestPaymentMongoId.toString());
    assert.equal(body.data[0].payment.paymentStatus, "PAID");
    assert.deepEqual(body.page, {
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  } finally {
    User.findById = originalUserFindById;
    Client.exists = originalClientExists;
    Service.find = originalServiceFind;
    Service.countDocuments = originalServiceCountDocuments;
    Company.find = originalCompanyFind;
    Payment.find = originalPaymentFind;
  }
});

test("rejects invalid Client Service list params and query", async () => {
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
      `${baseUrl}/api/v1/clients/not-an-object-id/services?page=0&unknown=value`,
      { headers: { Cookie: authenticatedCookie("ADMIN") } }
    );
    const body = await response.json();

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.deepEqual(
      [...new Set(body.error.details.map(({ field }) => field))].sort(),
      ["clientMongoId", "page", "unknown"]
    );
  } finally {
    User.findById = originalFindById;
  }
});

test("edits a Service scoped by Client MongoDB _id", async () => {
  const originalUserFindById = User.findById;
  const originalClientExists = Client.exists;
  const originalServiceFindOne = Service.findOne;
  const clientMongoId = new mongoose.Types.ObjectId();
  const serviceMongoId = new mongoose.Types.ObjectId();
  let serviceFilter;
  let appliedChanges;
  const serviceDocument = {
    _id: serviceMongoId,
    client: clientMongoId,
    category: "VAT_REGISTRATION",
    status: "NOT_STARTED",
    detail: { oldField: "replaced" },
    version: 0,
    set(changes) {
      appliedChanges = changes;
      Object.assign(this, changes);
    },
    async save() {
      this.version += 1;
    },
    toObject() {
      return {
        _id: this._id,
        client: this.client,
        category: this.category,
        status: this.status,
        detail: this.detail,
        version: this.version,
      };
    },
  };

  User.findById = () =>
    queryReturning({
      _id: { toString: () => "user-123" },
      name: "Admin Name",
      email: "admin@example.test",
      role: "ADMIN",
      status: "ACTIVE",
      version: 0,
    });
  Client.exists = async (filter) => {
    assert.deepEqual(filter, { _id: clientMongoId.toString() });
    return { _id: clientMongoId };
  };
  Service.findOne = (filter) => {
    serviceFilter = filter;
    return queryReturning(serviceDocument);
  };

  try {
    const response = await fetch(
      `${baseUrl}/api/v1/clients/${clientMongoId}/services/${serviceMongoId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: authenticatedCookie("ADMIN"),
        },
        body: JSON.stringify({
          status: "IN_PROGRESS",
          detail: {
            applicationType: "New",
            submissionReference: "VAT-1001",
          },
        }),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("etag"), '"1"');
    assert.deepEqual(serviceFilter, {
      _id: serviceMongoId.toString(),
      client: clientMongoId.toString(),
    });
    assert.deepEqual(appliedChanges, {
      status: "IN_PROGRESS",
      detail: {
        applicationType: "New",
        submissionReference: "VAT-1001",
      },
    });
    assert.equal(body.data.id, serviceMongoId.toString());
    assert.equal(body.data.status, "IN_PROGRESS");
    assert.equal(body.data.detail.oldField, undefined);
    assert.equal(body.data.detail.submissionReference, "VAT-1001");
    assert.equal(body.data.version, 1);
  } finally {
    User.findById = originalUserFindById;
    Client.exists = originalClientExists;
    Service.findOne = originalServiceFindOne;
  }
});

test("rejects empty and immutable fields in a Service edit", async () => {
  const originalUserFindById = User.findById;
  const clientMongoId = new mongoose.Types.ObjectId();
  const serviceMongoId = new mongoose.Types.ObjectId();

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
      `${baseUrl}/api/v1/clients/${clientMongoId}/services/${serviceMongoId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: authenticatedCookie("ADMIN"),
        },
        body: JSON.stringify({ client: clientMongoId.toString(), detail: {} }),
      }
    );
    const body = await response.json();
    const fields = new Set(body.error.details.map(({ field }) => field));

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.equal(fields.has("client"), true);
    assert.equal(fields.has("detail"), true);
  } finally {
    User.findById = originalUserFindById;
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

test("updates only allow-listed Client fields using the public clientId", async () => {
  const originalUserFindById = User.findById;
  const originalClientFindOne = Client.findOne;
  let lookupFilter;
  let appliedChanges;
  const clientDocument = {
    _id: new mongoose.Types.ObjectId(),
    clientId: "client-123",
    name: "Old Name",
    emiratesIdNumber: "OLD-ID",
    emailAddress: "old@example.test",
    mobileNumber: "971500000000",
    whatsappNumber: "971500000000",
    clientType: "INDIVIDUAL",
    nationality: "UAE",
    passportNumber: "OLD-PASSPORT",
    address: "Old address",
    preferredCommunicationMethod: "EMAIL",
    clientStatus: "ACTIVE",
    version: 0,
    set(changes) {
      appliedChanges = changes;
      Object.assign(this, changes);
    },
    async save() {
      this.version += 1;
    },
  };

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
    return queryReturning(clientDocument);
  };

  const update = {
    name: "Adesh Singh",
    emiratesIdNumber: "PAP-2027-2019",
    emailAddress: "ADESHsingh@GMAIL.COM",
    mobileNumber: "971501234567",
    whatsappNumber: "971501234567",
    clientType: "INDIVIDUAL",
    nationality: "UAE",
    passportNumber: "PAP-2027",
    address: null,
    preferredCommunicationMethod: "CALL",
    clientStatus: "ACTIVE",
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/clients/client-123`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: authenticatedCookie("ADMIN"),
      },
      body: JSON.stringify(update),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("etag"), '"1"');
    assert.deepEqual(lookupFilter, { clientId: "client-123" });
    assert.equal(appliedChanges.emailAddress, "adeshsingh@gmail.com");
    assert.deepEqual(body.data, {
      ...update,
      emailAddress: "adeshsingh@gmail.com",
    });
    assert.equal(body.data.clientId, undefined);
    assert.equal(body.data.notes, undefined);
  } finally {
    User.findById = originalUserFindById;
    Client.findOne = originalClientFindOne;
  }
});

test("rejects empty and non-allow-listed Client updates", async () => {
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
    const [emptyResponse, unknownResponse] = await Promise.all([
      fetch(`${baseUrl}/api/v1/clients/client-123`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: authenticatedCookie("ADMIN"),
        },
        body: JSON.stringify({}),
      }),
      fetch(`${baseUrl}/api/v1/clients/client-123`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: authenticatedCookie("ADMIN"),
        },
        body: JSON.stringify({ notes: "Not editable" }),
      }),
    ]);
    const emptyBody = await emptyResponse.json();
    const unknownBody = await unknownResponse.json();

    assert.equal(emptyResponse.status, 422);
    assert.equal(emptyBody.error.code, "VALIDATION_FAILED");
    assert.equal(unknownResponse.status, 422);
    assert.equal(unknownBody.error.code, "VALIDATION_FAILED");
    assert.equal(
      unknownBody.error.details.some(({ field }) => field === "notes"),
      true
    );
  } finally {
    User.findById = originalUserFindById;
  }
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
          passportNumber: "P123456",
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
      clientType: null,
      nationality: null,
      passportNumber: "P123456",
      address: null,
      preferredCommunicationMethod: null,
      clientStatus: "ACTIVE",
    });
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
            passportNumber: "P123456",
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
        clientType: null,
        nationality: null,
        passportNumber: "P123456",
        address: null,
        preferredCommunicationMethod: null,
        clientStatus: "ACTIVE",
      },
    ]);
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
