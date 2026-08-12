import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import Company, {
  COMPANY_STATUSES,
  COMPANY_TYPES,
} from "../src/modules/company/models/company.model.js";
import Counter from "../src/modules/common/models/counter.model.js";

const clientId = () => new mongoose.Types.ObjectId();

test("generates a prefixed company ID using the company counter", async () => {
  const originalFindOneAndUpdate = Counter.findOneAndUpdate;
  let receivedFilter;

  Counter.findOneAndUpdate = (filter) => {
    receivedFilter = filter;

    return {
      async exec() {
        return { name: "company", count: 12 };
      },
    };
  };

  try {
    const company = new Company({
      client: clientId(),
      companyName: "Example Company",
      companyType: "MAINLAND",
    });

    await company.validate();

    assert.equal(company.companyId, "comp-12");
    assert.deepEqual(receivedFilter, { name: "company" });
    assert.equal(company.companyStatus, "ACTIVE");
  } finally {
    Counter.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test("supports company details, nested records, and note arrays", async () => {
  const referencedClientId = clientId();
  const company = new Company({
    client: referencedClientId,
    companyId: "comp-20",
    companyName: "Example Free Zone Company",
    tradeName: "Example Trading",
    legalName: "Example Free Zone Company FZ-LLC",
    companyType: "FREE_ZONE",
    freeZoneName: "Example Free Zone",
    licence: {
      number: "LIC-123",
      activity: "Insurance services",
      issueDate: new Date("2026-01-01"),
      expiryDate: new Date("2027-01-01"),
    },
    establishment: {
      cardNumber: "EST-123",
      cardExpiryDate: new Date("2027-01-01"),
    },
    companyEmail: " INFO@EXAMPLE.TEST ",
    companyMobile: "+971501234567",
    address: "Dubai, UAE",
    iban: " ae070331234567890123456 ",
    notes: ["First company note"],
  });

  await company.validate();

  assert.equal(company.client.toString(), referencedClientId.toString());
  assert.equal(company.companyEmail, "info@example.test");
  assert.equal(company.iban, "AE070331234567890123456");
  assert.equal(company.licence.number, "LIC-123");
  assert.equal(company.establishment.cardNumber, "EST-123");
  assert.deepEqual(company.notes, ["First company note"]);
});

test("requires the company name and restricts type and status", async () => {
  const company = new Company({
    client: clientId(),
    companyId: "comp-21",
    companyType: "LOCAL",
    companyStatus: "INACTIVE",
  });
  const error = await company
    .validate()
    .catch((validationError) => validationError);

  assert.deepEqual(COMPANY_TYPES, ["MAINLAND", "FREE_ZONE", "OFFSHORE"]);
  assert.deepEqual(COMPANY_STATUSES, [
    "ACTIVE",
    "UNDER_FORMATION",
    "SUSPENDED",
    "EXPIRED",
    "CLOSED",
  ]);
  assert.ok(error.errors.companyName);
  assert.ok(error.errors.companyType);
  assert.ok(error.errors.companyStatus);
});

test("requires a Client reference", async () => {
  const company = new Company({
    companyId: "comp-22",
    companyName: "Example Company",
    companyType: "MAINLAND",
  });
  const error = await company
    .validate()
    .catch((validationError) => validationError);

  assert.ok(error.errors.client);
});

test("defines immutable unique IDs and optimistic concurrency", () => {
  const companyIdIndex = Company.schema
    .indexes()
    .find(([fields]) => fields.companyId === 1);
  const clientCompaniesIndex = Company.schema
    .indexes()
    .find(
      ([fields]) =>
        fields.client === 1 &&
        fields.createdAt === -1 &&
        fields.companyId === 1
    );

  assert.equal(companyIdIndex?.[1].unique, true);
  assert.ok(clientCompaniesIndex);
  assert.equal(Company.schema.path("client").instance, "ObjectId");
  assert.equal(Company.schema.path("client").options.ref, "Client");
  assert.equal(Company.schema.path("companyId").options.immutable, true);
  assert.equal(Company.schema.options.versionKey, "version");
  assert.equal(Company.schema.options.optimisticConcurrency, true);
});
