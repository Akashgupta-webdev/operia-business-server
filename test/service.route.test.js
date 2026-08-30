import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import app from "../src/app.js";
import Service from "../src/modules/operio-services/models/service.model.js";

let baseUrl;
let server;

before(async () => {
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

test("registers and validates the Service model", async () => {
  const service = new Service({
    name: "VAT Registration",
    code: "vat_registration",
    category: "Tax",
  });

  await service.validate();

  assert.equal(Service.modelName, "Service");
  assert.equal(service.code, "VAT_REGISTRATION");
  assert.equal(service.isActive, true);
  assert.equal(service.pricing.type, "fixed");
  assert.equal(service.pricing.amount, 0);
  assert.equal(service.pricing.currency, "INR");
});

test("creates a validated service", async () => {
  const originalCreate = Service.create;
  let createPayload;

  Service.create = async (payload) => {
    createPayload = payload;
    return {
      toJSON: () => ({
        id: "service-123",
        ...payload,
        isActive: payload.isActive ?? true,
        version: 0,
      }),
    };
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/service`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: " VAT Registration ",
        code: " vat_registration ",
        description: "Register a client for VAT",
        category: "Tax",
        appliesTo: ["client", "company"],
        fields: [
          {
            key: "taxRegistrationNumber",
            label: "Tax registration number",
            type: "text",
            required: true,
            order: 1,
          },
        ],
        pricing: {
          type: "fixed",
          amount: 500,
          currency: "aed",
        },
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("location"), "/api/v1/service/service-123");
    assert.equal(createPayload.name, "VAT Registration");
    assert.equal(createPayload.code, "VAT_REGISTRATION");
    assert.equal(createPayload.pricing.currency, "AED");
    assert.equal(body.data.id, "service-123");
    assert.equal(body.meta.correlationId, response.headers.get("x-correlation-id"));
  } finally {
    Service.create = originalCreate;
  }
});

test("rejects invalid and unknown service fields before persistence", async () => {
  const originalCreate = Service.create;
  let createCalled = false;
  Service.create = async () => {
    createCalled = true;
  };

  try {
    const response = await fetch(`${baseUrl}/api/v1/service`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: "INVALID",
        category: "Tax",
        appliesTo: ["unsupported"],
        unexpected: true,
      }),
    });
    const body = await response.json();
    const invalidFields = new Set(body.error.details.map(({ field }) => field));

    assert.equal(response.status, 422);
    assert.equal(body.error.code, "VALIDATION_FAILED");
    assert.ok(invalidFields.has("name"));
    assert.ok(invalidFields.has("appliesTo.0"));
    assert.ok(invalidFields.has("unexpected"));
    assert.equal(createCalled, false);
  } finally {
    Service.create = originalCreate;
  }
});

test("lists services with pagination, search, and category filtering", async () => {
  const originalFind = Service.find;
  const originalCountDocuments = Service.countDocuments;
  let capturedFilter;
  let capturedSort;
  let capturedSkip;
  let capturedLimit;

  Service.find = (filter) => {
    capturedFilter = filter;
    return {
      sort(value) {
        capturedSort = value;
        return this;
      },
      skip(value) {
        capturedSkip = value;
        return this;
      },
      limit(value) {
        capturedLimit = value;
        return this;
      },
      async exec() {
        return [
          {
            toJSON: () => ({
              id: "service-123",
              name: "VAT Registration",
              code: "VAT_REGISTRATION",
              category: "Tax",
              isActive: true,
              appliesTo: ["client", "company"],
              fields: [],
              pricing: { type: "fixed", amount: 500, currency: "AED" },
              version: 0,
              createdAt: "2026-08-24T10:00:00.000Z",
              updatedAt: "2026-08-24T10:00:00.000Z",
            }),
          },
        ];
      },
    };
  };
  Service.countDocuments = (filter) => ({
    async exec() {
      assert.equal(filter, capturedFilter);
      return 5;
    },
  });

  try {
    const query = new URLSearchParams({
      page: "2",
      limit: "2",
      search: "VAT.*",
      category: "Tax",
    });
    const response = await fetch(`${baseUrl}/api/v1/service?${query}`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(capturedFilter.category, "Tax");
    assert.equal(capturedFilter.$or.length, 3);
    assert.equal(capturedFilter.$or[0].name.source, "VAT\\.\\*");
    assert.equal(capturedFilter.$or[0].name.flags, "i");
    assert.deepEqual(capturedSort, { createdAt: -1, _id: 1 });
    assert.equal(capturedSkip, 2);
    assert.equal(capturedLimit, 2);
    assert.equal(body.data[0].id, "service-123");
    assert.deepEqual(body.page, {
      page: 2,
      limit: 2,
      total: 5,
      totalPages: 3,
    });
    assert.equal(body.meta.correlationId, response.headers.get("x-correlation-id"));
  } finally {
    Service.find = originalFind;
    Service.countDocuments = originalCountDocuments;
  }
});

test("applies service pagination defaults and rejects invalid queries", async () => {
  const originalFind = Service.find;
  const originalCountDocuments = Service.countDocuments;

  Service.find = () => ({
    sort() {
      return this;
    },
    skip() {
      return this;
    },
    limit() {
      return this;
    },
    async exec() {
      return [];
    },
  });
  Service.countDocuments = () => ({
    async exec() {
      return 0;
    },
  });

  try {
    const defaultResponse = await fetch(`${baseUrl}/api/v1/service`);
    const defaultBody = await defaultResponse.json();

    assert.equal(defaultResponse.status, 200);
    assert.deepEqual(defaultBody.data, []);
    assert.deepEqual(defaultBody.page, {
      page: 1,
      limit: 25,
      total: 0,
      totalPages: 0,
    });

    const invalidResponse = await fetch(
      `${baseUrl}/api/v1/service?page=0&limit=101&unknown=true`
    );
    const invalidBody = await invalidResponse.json();
    const invalidFields = new Set(
      invalidBody.error.details.map(({ field }) => field)
    );

    assert.equal(invalidResponse.status, 422);
    assert.ok(invalidFields.has("page"));
    assert.ok(invalidFields.has("limit"));
    assert.ok(invalidFields.has("unknown"));
  } finally {
    Service.find = originalFind;
    Service.countDocuments = originalCountDocuments;
  }
});
