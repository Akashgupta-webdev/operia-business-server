import assert from "node:assert/strict";
import test from "node:test";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ProfitLossRoute from "../src/modules/profit-loss/profitLoss.route.js";
import {
  buildRevenueInflowPipeline,
  getRevenueInflow,
} from "../src/modules/profit-loss/service/revenueInflow.service.js";
import { getRevenueInflowQuerySchema } from "../src/modules/profit-loss/validators/revenueInflow.validator.js";
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

const REVENUE_INFLOW = {
  clientName: "Example Client",
  servicePackage: "Mainland LLC Company Formation Package",
  serviceCategory: "Business Setup",
  packagePrice: "12500.00",
  paymentStatus: "Paid",
  serviceStatus: "Completed",
};

// Stubs the Client Service aggregation with a deterministic Revenue Inflow page.
// Returning a restore callback prevents model mutations from leaking between tests.
const stubRevenueInflowAggregate = () => {
  const originalAggregate = ClientService.aggregate;
  let receivedPipeline;

  ClientService.aggregate = (pipeline) => {
    receivedPipeline = pipeline;
    return {
      async exec() {
        return [{ data: [REVENUE_INFLOW], metadata: [{ total: 1 }] }];
      },
    };
  };

  return {
    getReceivedPipeline: () => receivedPipeline,
    restore: () => {
      ClientService.aggregate = originalAggregate;
    },
  };
};

test("validates Revenue Inflow pagination and rejects unknown query fields", () => {
  const defaults = getRevenueInflowQuerySchema.validate({});
  const invalid = getRevenueInflowQuerySchema.validate(
    { page: 0, limit: 101, unknown: true },
    { abortEarly: false }
  );

  assert.deepEqual(defaults.value, { page: 1, limit: 20 });
  assert.deepEqual(
    invalid.error.details.map((detail) => detail.path.join(".")).sort(),
    ["limit", "page", "unknown"]
  );
});

test("builds and executes the paginated Revenue Inflow projection", async () => {
  const pipeline = buildRevenueInflowPipeline({ page: 2, limit: 10 });
  const facet = pipeline.at(-1).$facet;
  const project = facet.data.at(-1).$project;

  assert.equal(pipeline[0].$lookup.from, "clients");
  assert.deepEqual(facet.data[1], { $skip: 10 });
  assert.deepEqual(facet.data[2], { $limit: 10 });
  assert.ok(project.clientName);
  assert.ok(project.servicePackage);
  assert.ok(project.serviceCategory);
  assert.ok(project.packagePrice);
  assert.ok(project.paymentStatus);
  assert.ok(project.serviceStatus);

  const stub = stubRevenueInflowAggregate();
  try {
    const result = await getRevenueInflow({ page: 1, limit: 20 });

    assert.deepEqual(result.revenueInflows, [REVENUE_INFLOW]);
    assert.deepEqual(result.page, {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
    assert.ok(stub.getReceivedPipeline().at(-1).$facet);
  } finally {
    stub.restore();
  }
});

test("serves GET /api/v1/profit-loss/revenue-inflow for an Admin", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const originalUserFindById = User.findById;
  const aggregateStub = stubRevenueInflowAggregate();
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

  const registeredRoute = ProfitLossRoute.stack.find(
    (layer) =>
      layer.route?.path === "/revenue-inflow" && layer.route.methods.get
  );
  assert.ok(registeredRoute);

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
      `http://127.0.0.1:${server.address().port}/api/v1/profit-loss/revenue-inflow`,
      { headers: { Cookie: `accessToken=${accessToken}` } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data, [REVENUE_INFLOW]);
    assert.deepEqual(body.page, {
      page: 1,
      limit: 20,
      total: 1,
      totalPages: 1,
    });
  } finally {
    User.findById = originalUserFindById;
    aggregateStub.restore();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
