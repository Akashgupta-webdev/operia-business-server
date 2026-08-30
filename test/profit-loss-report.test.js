import assert from "node:assert/strict";
import test from "node:test";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import ClientPayment from "../src/modules/clients/models/clientPayment.model.js";
import ClientService, {
  CLIENT_SERVICE_CATEGORIES,
} from "../src/modules/clients/models/clientService.model.js";
import { EXPENSE_CATEGORIES } from "../src/modules/profit-loss/model/expense.model.js";
import Expense from "../src/modules/profit-loss/model/expense.model.js";
import ProfitLossRoute from "../src/modules/profit-loss/profitLoss.route.js";
import {
  buildAccountReceivablePipeline,
  buildCategoryAmountPipeline,
  buildProfitLossDateRange,
  getProfitLoss,
} from "../src/modules/profit-loss/service/profitLoss.service.js";
import { getProfitLossQuerySchema } from "../src/modules/profit-loss/validators/profitLoss.validator.js";
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

const SERVICE_AGGREGATE_RESULT = [
  {
    categories: [{ category: "Business Setup", amount: "50000.00" }],
    total: [{ amount: "50000.00" }],
  },
];
const EXPENSE_AGGREGATE_RESULT = [
  {
    categories: [
      { category: "Office Rent & Utilities", amount: "20000.00" },
    ],
    total: [{ amount: "20000.00" }],
  },
];
const RECEIVABLE_AGGREGATE_RESULT = [{ amount: "7500.00" }];

// Replaces the three report aggregations with deterministic monthly totals.
// Returning a restore callback keeps model mutations isolated to each test.
const stubProfitLossAggregates = () => {
  const originalServiceAggregate = ClientService.aggregate;
  const originalExpenseAggregate = Expense.aggregate;
  const originalPaymentAggregate = ClientPayment.aggregate;

  ClientService.aggregate = () => ({
    async exec() {
      return SERVICE_AGGREGATE_RESULT;
    },
  });
  Expense.aggregate = () => ({
    async exec() {
      return EXPENSE_AGGREGATE_RESULT;
    },
  });
  ClientPayment.aggregate = () => ({
    async exec() {
      return RECEIVABLE_AGGREGATE_RESULT;
    },
  });

  return () => {
    ClientService.aggregate = originalServiceAggregate;
    Expense.aggregate = originalExpenseAggregate;
    ClientPayment.aggregate = originalPaymentAggregate;
  };
};

test("validates required Profit and Loss month and year query fields", () => {
  const valid = getProfitLossQuerySchema.validate({ month: "8", year: "2026" });
  const invalid = getProfitLossQuerySchema.validate(
    { month: 13, year: 1999, extra: true },
    { abortEarly: false }
  );
  const missing = getProfitLossQuerySchema.validate({}, { abortEarly: false });

  assert.deepEqual(valid.value, { month: 8, year: 2026 });
  assert.deepEqual(
    invalid.error.details.map((detail) => detail.path.join(".")).sort(),
    ["extra", "month", "year"]
  );
  assert.deepEqual(
    missing.error.details.map((detail) => detail.path.join(".")).sort(),
    ["month", "year"]
  );
});

test("builds UTC monthly category and receivable aggregations", () => {
  const range = buildProfitLossDateRange({ month: 12, year: 2026 });
  const categoryPipeline = buildCategoryAmountPipeline({
    ...range,
    dateField: "expenseDate",
    fallbackDateField: "createdAt",
    categoryField: "expenseCategory",
    amountField: "expenseAmount",
  });
  const receivablePipeline = buildAccountReceivablePipeline(range);

  assert.equal(range.startDate.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(range.endDate.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.deepEqual(categoryPipeline[0].$set.reportDate, {
    $ifNull: ["$expenseDate", "$createdAt"],
  });
  assert.ok(categoryPipeline.at(-1).$facet.categories);
  assert.ok(categoryPipeline.at(-1).$facet.total);
  assert.deepEqual(receivablePipeline[0].$match.createdAt, {
    $gte: range.startDate,
    $lt: range.endDate,
  });
  assert.ok(receivablePipeline[1].$set.outstandingAmount.$subtract);
});

test("returns exact monthly KPIs and stable category arrays", async () => {
  const restoreAggregates = stubProfitLossAggregates();

  try {
    const result = await getProfitLoss({ month: 8, year: 2026 });

    assert.deepEqual(result.period, { month: 8, year: 2026 });
    assert.deepEqual(result.kpi, {
      collectedInflow: "50000.00",
      totalOutflow: "20000.00",
      netOperatingProfit: "30000.00",
      netOperatingProfitMargin: 60,
      accountReceivable: "7500.00",
    });
    assert.equal(result.inflows.categories.length, CLIENT_SERVICE_CATEGORIES.length);
    assert.equal(result.outflows.categories.length, EXPENSE_CATEGORIES.length);
    assert.deepEqual(result.inflows.categories[0], {
      category: "Business Setup",
      amount: "50000.00",
    });
    assert.deepEqual(
      result.outflows.categories.find(
        ({ category }) => category === "Office Rent & Utilities"
      ),
      { category: "Office Rent & Utilities", amount: "20000.00" }
    );
    assert.equal(result.inflows.totalGrossRevenue, "50000.00");
    assert.equal(result.outflows.totalOperatingExpense, "20000.00");
  } finally {
    restoreAggregates();
  }
});

test("serves GET /api/v1/profit-loss for an Admin", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const originalUserFindById = User.findById;
  const restoreAggregates = stubProfitLossAggregates();
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
    (layer) => layer.route?.path === "/" && layer.route.methods.get
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
      `http://127.0.0.1:${server.address().port}/api/v1/profit-loss?month=8&year=2026`,
      { headers: { Cookie: `accessToken=${accessToken}` } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body.data.period, { month: 8, year: 2026 });
    assert.equal(body.data.kpi.netOperatingProfit, "30000.00");
    assert.equal(body.data.inflows.totalGrossRevenue, "50000.00");
    assert.equal(body.data.outflows.totalOperatingExpense, "20000.00");
  } finally {
    User.findById = originalUserFindById;
    restoreAggregates();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
