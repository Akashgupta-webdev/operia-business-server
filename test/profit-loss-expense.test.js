import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Expense, {
  EXPENSE_CATEGORIES,
  EXPENSE_PAYMENT_METHODS,
} from "../src/modules/profit-loss/model/expense.model.js";
import ProfitLossRoute from "../src/modules/profit-loss/profitLoss.route.js";
import { createExpense } from "../src/modules/profit-loss/service/expense.service.js";
import { createExpenseBodySchema } from "../src/modules/profit-loss/validators/expense.validator.js";
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

const completeExpense = {
  expenseTitle: "August office rent",
  expenseCategory: "Office Rent & Utilities",
  expenseAmount: "12500.00",
  expenseDate: "2026-08-30",
  paymentMethod: "Bank Transfer / Online",
  vendorName: "Example Properties LLC",
  receiptReference: "RENT-2026-08",
  notes: "Office rent for August 2026",
};

test("defines the documented Expense schema and enum values", async () => {
  assert.deepEqual(EXPENSE_CATEGORIES, [
    "Government & Authority Fees",
    "Typing & Amer Centers",
    "PRO Processing & Courier",
    "Office Rent & Utilities",
    "Software & Cloud Tools",
    "Salaries & Professional Fees",
    "Miscellaneous Operations",
  ]);
  assert.deepEqual(EXPENSE_PAYMENT_METHODS, [
    "Bank Transfer / Online",
    "Corporate Credit Card",
    "Cash / Petty Cash",
    "PRO Reimbursement",
  ]);

  const expense = new Expense({
    ...completeExpense,
    expenseDate: new Date("2026-08-30T00:00:00.000Z"),
  });
  await expense.validate();
  assert.equal(expense.expenseAmount.toString(), "12500.00");
  assert.equal(Expense.schema.options.collection, "expenses");
  assert.equal(Expense.schema.options.versionKey, "version");
});

test("enforces required Expense fields and model enum constraints", async () => {
  const missingRequired = new Expense({});
  const invalidEnums = new Expense({
    expenseTitle: "Invalid enums",
    expenseCategory: "Unknown",
    paymentMethod: "Cheque",
    expenseAmount: "-1.00",
  });

  const missingRequiredError = await missingRequired.validate().catch(
    (error) => error
  );
  const invalidEnumsError = await invalidEnums.validate().catch(
    (error) => error
  );

  assert.ok(missingRequiredError.errors.expenseTitle);
  assert.ok(missingRequiredError.errors.expenseCategory);
  assert.ok(invalidEnumsError.errors.expenseCategory);
  assert.ok(invalidEnumsError.errors.paymentMethod);
  assert.ok(invalidEnumsError.errors.expenseAmount);
});

test("validates and normalizes the Expense API body", () => {
  const valid = createExpenseBodySchema.validate({
    ...completeExpense,
    expenseTitle: "  August office rent  ",
  });
  const invalid = createExpenseBodySchema.validate(
    {
      expenseCategory: "Unknown",
      expenseAmount: 12500.5,
      expenseDate: "2026-02-31",
      paymentMethod: "Cheque",
      unknown: true,
    },
    { abortEarly: false }
  );

  assert.equal(valid.error, undefined);
  assert.equal(valid.value.expenseTitle, "August office rent");
  assert.deepEqual(
    invalid.error.details.map((detail) => detail.path.join(".")).sort(),
    [
      "expenseAmount",
      "expenseCategory",
      "expenseDate",
      "expenseTitle",
      "paymentMethod",
      "unknown",
    ]
  );
});

test("converts the validated expenseDate to midnight UTC in the service", async () => {
  const originalCreate = Expense.create;
  let createdPayload;
  Expense.create = async (payload) => {
    createdPayload = payload;
    return new Expense({ _id: new mongoose.Types.ObjectId(), ...payload });
  };

  try {
    await createExpense(completeExpense);

    assert.equal(
      createdPayload.expenseDate.toISOString(),
      "2026-08-30T00:00:00.000Z"
    );
    assert.equal(createdPayload.expenseAmount, "12500.00");
  } finally {
    Expense.create = originalCreate;
  }
});

test("serves POST /api/v1/profit-loss/expense for an Admin", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const expenseId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalExpenseCreate = Expense.create;
  let createdPayload;

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
  Expense.create = async (payload) => {
    createdPayload = payload;
    const expense = new Expense({ _id: expenseId, ...payload });
    expense.set("version", 0);
    return expense;
  };

  const registeredRoute = ProfitLossRoute.stack.find(
    (layer) => layer.route?.path === "/expense" && layer.route.methods.post
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
      `http://127.0.0.1:${server.address().port}/api/v1/profit-loss/expense`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `accessToken=${accessToken}`,
        },
        body: JSON.stringify(completeExpense),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(response.headers.get("etag"), '"0"');
    assert.equal(
      response.headers.get("location"),
      `/api/v1/profit-loss/expense/${expenseId}`
    );
    assert.equal(createdPayload.expenseDate instanceof Date, true);
    assert.equal(body.data.id, expenseId.toString());
    assert.deepEqual(body.data.expenseAmount, { $numberDecimal: "12500.00" });
  } finally {
    User.findById = originalUserFindById;
    Expense.create = originalExpenseCreate;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
