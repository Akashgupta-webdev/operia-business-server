import assert from "node:assert/strict";
import test from "node:test";

import { createClientWithServiceSchema } from "../src/modules/clients/validators/client.validator.js";

const individualPayload = {
  client: {
    clientType: "INDIVIDUAL",
    name: "Example Person",
    mobileNumber: "+971501234567",
    whatsappNumber: "+971501234567",
    emailAddress: "person@example.test",
    nationality: "Emirati",
    passportNumber: "P123456",
    emiratesIdNumber: "784-0000-0000000-0",
    preferredCommunicationMethod: "EMAIL",
  },
  service: {
    category: "VAT_REGISTRATION",
    status: "NOT_STARTED",
    detail: { applicationType: "New" },
  },
};

test("accepts a complete individual Client Service without a Company", () => {
  const { error, value } = createClientWithServiceSchema.validate(
    individualPayload,
    { abortEarly: false }
  );

  assert.equal(error, undefined);
  assert.equal(value.company, undefined);
});

test("requires a Company and its required fields for a company Client", () => {
  const { error } = createClientWithServiceSchema.validate(
    {
      ...individualPayload,
      client: { ...individualPayload.client, clientType: "COMPANY" },
    },
    { abortEarly: false }
  );

  assert.ok(error.details.some((detail) => detail.path.join(".") === "company"));
});

test("rejects a Company section for an individual Client", () => {
  const { error } = createClientWithServiceSchema.validate({
    ...individualPayload,
    company: {
      companyName: "Should Not Be Stored",
      companyType: "MAINLAND",
      licence: { number: "LIC-1", expiryDate: "2027-01-01" },
    },
  });

  assert.equal(error.details[0].path.join("."), "company");
});

test("accepts optional Payment and Reminder sections with decimal strings", () => {
  const { error } = createClientWithServiceSchema.validate({
    ...individualPayload,
    payment: {
      governmentFee: "100.25",
      serviceFee: "10.00",
      totalAmount: "110.25",
      amountReceived: "50.00",
      paymentMethod: "BANK_TRANSFER",
      paymentDate: "2026-08-14T00:00:00Z",
      paymentStatus: "PARTIAL",
    },
    reminder: {
      dueDate: "2026-09-30T00:00:00Z",
      reminderBefore: 7,
      followUpsDate: "2026-09-23T00:00:00Z",
    },
  });

  assert.equal(error, undefined);
});
