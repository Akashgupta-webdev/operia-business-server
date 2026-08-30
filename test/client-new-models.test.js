import assert from "node:assert/strict";
import test from "node:test";

import Client from "../src/modules/clients/models/client.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientDriver from "../src/modules/clients/models/clientDrivers.model.js";
import ClientMember from "../src/modules/clients/models/clientMembers.model.js";
import ClientPayment from "../src/modules/clients/models/clientPayment.model.js";
import ClientReminder from "../src/modules/clients/models/clientReminder.model.js";
import ClientVehicle from "../src/modules/clients/models/clientVehicles.model.js";
import Company from "../src/modules/company/models/company.model.js";

const referencedModels = [
  Company,
  ClientMember,
  ClientVehicle,
  ClientDriver,
  ClientDocument,
  ClientPayment,
  ClientReminder,
];

const businessPaths = (Model) =>
  Object.keys(Model.schema.paths)
    .filter(
      (path) => !["_id", "createdAt", "updatedAt", "version"].includes(path)
    )
    .sort();

test("new models expose only the requested business fields", () => {
  const expectedPaths = new Map([
    [
      Client,
      [
        "emailAddress",
        "emirates",
        "healthInsurance",
        "mobileNumber",
        "name",
        "nationality",
        "passport",
        "visa",
        "whatsappNumber",
      ],
    ],
    [
      Company,
      [
        "client",
        "companyLegalName",
        "corporateTaxNumber",
        "licenceExpiryDate",
        "tradeLicenceNumber",
        "vatTaxRegistrationNumber",
      ],
    ],
    [
      ClientMember,
      [
        "client",
        "emirates",
        "healthInsurance",
        "memberType",
        "name",
        "passport",
        "visa",
      ],
    ],
    [
      ClientVehicle,
      [
        "client",
        "insuranceExpiry",
        "policyNumber",
        "registrationExpiry",
        "registrationNumer",
        "tcNumber",
      ],
    ],
    [
      ClientDriver,
      ["client", "licenceExpiryDate", "licenceIssueDate", "name"],
    ],
    [
      ClientDocument,
      [
        "client",
        "documentTitle",
        "documentType",
        "documentURL",
        "expiryDate",
        "issueDate",
      ],
    ],
    [
      ClientPayment,
      [
        "amountReceived",
        "client",
        "notes",
        "paymentMethod",
        "paymentStatus",
        "totalBilled",
      ],
    ],
    [
      ClientReminder,
      ["client", "followupDate", "notes", "priority", "remindBefore"],
    ],
  ]);

  for (const [Model, paths] of expectedPaths) {
    assert.deepEqual(businessPaths(Model), paths.sort());
  }
});

test("only client references are required in the new models", () => {
  assert.equal(Client.schema.path("name").options.required, undefined);

  for (const Model of referencedModels) {
    assert.equal(Model.schema.path("client").options.ref, "Client");
    assert.ok(Model.schema.path("client").options.required);

    const otherRequiredPaths = Object.entries(Model.schema.paths)
      .filter(([name, path]) => name !== "client" && path.options.required)
      .map(([name]) => name);

    assert.deepEqual(otherRequiredPaths, []);
  }
});

test("client identity formats and nationality values are validated", async () => {
  const validClient = new Client({
    nationality: "United Arab Emirates",
    passport: {
      passportNumber: "A1234567",
      passportIssueDate: "01-01-2020",
      passportExpiryDate: "01-01-2030",
    },
    emirates: { emiratesId: "784-1990-1234567-1" },
    visa: { visaUIDNumber: "123456789" },
  });

  await validClient.validate();

  const error = await new Client({
    nationality: "Unknown",
    passport: { passportNumber: "123" },
    emirates: { emiratesId: "bad" },
    visa: { visaUIDNumber: "123" },
  })
    .validate()
    .catch((validationError) => validationError);

  assert.ok(error.errors.nationality);
  assert.ok(error.errors["passport.passportNumber"]);
  assert.ok(error.errors["emirates.emiratesId"]);
  assert.ok(error.errors["visa.visaUIDNumber"]);
});

test("client reminder defaults are applied", () => {
  const reminder = new ClientReminder({ client: new Client()._id });

  assert.equal(reminder.remindBefore, "7 day before");
  assert.equal(reminder.priority, "Normal");
});
