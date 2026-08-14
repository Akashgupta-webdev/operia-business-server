import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import Client, {
  CLIENT_TYPES,
} from "../src/modules/clients/models/client.model.js";
import Document from "../src/modules/common/models/document.model.js";
import Payment from "../src/modules/common/models/payment.model.js";
import Reminder from "../src/modules/common/models/reminder.model.js";
import Service, {
  SERVICE_CATEGORIES,
  SERVICE_STATUSES,
} from "../src/modules/common/models/service.model.js";

const objectId = () => new mongoose.Types.ObjectId();

test("defines the supported Client types", () => {
  const clientType = Client.schema.path("clientType");

  assert.deepEqual(CLIENT_TYPES, ["INDIVIDUAL", "COMPANY"]);
  assert.deepEqual(clientType.enumValues, CLIENT_TYPES);
  assert.equal(clientType.options.default, "INDIVIDUAL");
  assert.equal(clientType.isRequired, true);
});

test("stores dynamic Service detail for a Company", async () => {
  const company = objectId();
  const client = objectId();
  const service = new Service({
    company,
    client,
    category: "TRADE_LICENCE_NEW_RENEWAL_AMENDMENT",
    detail: {
      serviceName: "Trade licence renewal",
      durationDays: 5,
      expedited: true,
    },
  });

  await service.validate();

  assert.equal(service.company.toString(), company.toString());
  assert.equal(service.client.toString(), client.toString());
  assert.equal(service.category, "TRADE_LICENCE_NEW_RENEWAL_AMENDMENT");
  assert.equal(service.status, "NOT_STARTED");
  assert.equal(service.detail.get("serviceName"), "Trade licence renewal");
  assert.equal(service.detail.get("durationDays"), 5);
  assert.equal(Service.schema.path("company").options.ref, "Company");
  assert.equal(Service.schema.path("client").options.ref, "Client");
  assert.deepEqual(Service.schema.path("category").enumValues, SERVICE_CATEGORIES);
  assert.deepEqual(Service.schema.path("status").enumValues, SERVICE_STATUSES);
  const serviceIndex = Service.schema.indexes().find(
    ([fields]) =>
      fields.client === 1 &&
      fields.company === 1 &&
      fields.status === 1 &&
      fields.createdAt === -1 &&
      fields._id === 1
  );
  assert.ok(serviceIndex);
});

test("requires Service detail to contain at least one field", async () => {
  const service = new Service({
    company: objectId(),
    client: objectId(),
    category: "VAT_REGISTRATION",
    detail: {},
  });
  const error = await service
    .validate()
    .catch((validationError) => validationError);

  assert.ok(error.errors.detail);
});

test("restricts Service category and status to their approved values", async () => {
  const service = new Service({
    company: objectId(),
    client: objectId(),
    category: "UNKNOWN_SERVICE",
    status: "CANCELLED",
    detail: { name: "Example" },
  });
  const error = await service
    .validate()
    .catch((validationError) => validationError);

  assert.equal(SERVICE_CATEGORIES.length, 24);
  assert.deepEqual(SERVICE_STATUSES, [
    "NOT_STARTED",
    "IN_PROGRESS",
    "SUBMITTED",
    "COMPLETE",
  ]);
  assert.ok(error.errors.category);
  assert.ok(error.errors.status);
});

test("allows an individual Service without a Company and requires its Client", async () => {
  const service = new Service({
    category: "OTHER_CUSTOM_SERVICE",
    detail: { description: "Custom work" },
  });
  const error = await service
    .validate()
    .catch((validationError) => validationError);

  assert.ok(error.errors.client);
  assert.notEqual(Service.schema.path("company").isRequired, true);
});

test("allows individual supporting records without a Company", async () => {
  const service = objectId();
  const document = new Document({
    service,
    documentUrl: "https://files.example.test/individual.pdf",
  });
  const payment = new Payment({
    service,
    governmentFee: "0",
    serviceFee: "10",
    totalAmount: "10",
    amountReceived: "10",
    paymentMethod: "CASH",
    paymentDate: new Date("2026-08-14T00:00:00Z"),
    paymentStatus: "COMPLETE",
  });
  const reminder = new Reminder({
    service,
    dueDate: new Date("2026-09-30T00:00:00Z"),
    reminderBefore: 7,
    followUpsDate: new Date("2026-09-23T00:00:00Z"),
  });

  await Promise.all([
    document.validate(),
    payment.validate(),
    reminder.validate(),
  ]);

  assert.equal(document.company, undefined);
  assert.equal(payment.company, undefined);
  assert.equal(reminder.company, undefined);
});

test("links a Document to its Company and Service", async () => {
  const document = new Document({
    company: objectId(),
    service: objectId(),
    documentUrl: " https://files.example.test/document.pdf ",
  });

  await document.validate();

  assert.equal(document.documentUrl, "https://files.example.test/document.pdf");
  assert.equal(Document.schema.path("company").options.ref, "Company");
  assert.equal(Document.schema.path("service").options.ref, "Service");
});

test("stores Payment amounts as non-floating-point decimals", async () => {
  const payment = new Payment({
    company: objectId(),
    service: objectId(),
    governmentFee: "100.25",
    serviceFee: "50.10",
    totalAmount: "150.35",
    amountReceived: "100.00",
    paymentMethod: " bank_transfer ",
    paymentDate: new Date("2026-08-14T00:00:00Z"),
    paymentStatus: " partial ",
  });

  await payment.validate();

  assert.equal(payment.governmentFee.toString(), "100.25");
  assert.equal(payment.serviceFee.toString(), "50.10");
  assert.equal(payment.paymentMethod, "BANK_TRANSFER");
  assert.equal(payment.paymentStatus, "PARTIAL");
  assert.equal(Payment.schema.path("company").options.ref, "Company");
  assert.equal(Payment.schema.path("service").options.ref, "Service");
});

test("rejects a negative Payment amount", async () => {
  const payment = new Payment({
    company: objectId(),
    service: objectId(),
    governmentFee: "-0.01",
    serviceFee: "0",
    totalAmount: "0",
    amountReceived: "0",
    paymentMethod: "CASH",
    paymentDate: new Date("2026-08-14T00:00:00Z"),
    paymentStatus: "PENDING",
  });
  const error = await payment
    .validate()
    .catch((validationError) => validationError);

  assert.ok(error.errors.governmentFee);
});

test("validates Reminder dates and whole reminder-before days", async () => {
  const reminder = new Reminder({
    company: objectId(),
    service: objectId(),
    dueDate: new Date("2026-09-30T00:00:00Z"),
    reminderBefore: 30,
    followUpsDate: new Date("2026-09-01T00:00:00Z"),
    notes: "Contact the client before renewal.",
  });

  await reminder.validate();

  assert.equal(reminder.reminderBefore, 30);
  assert.equal(Reminder.schema.path("company").options.ref, "Company");
  assert.equal(Reminder.schema.path("service").options.ref, "Service");
  assert.equal(Reminder.schema.options.versionKey, "version");
  assert.equal(Reminder.schema.options.optimisticConcurrency, true);
});
