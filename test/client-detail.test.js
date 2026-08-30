import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientDriver from "../src/modules/clients/models/clientDrivers.model.js";
import ClientMember from "../src/modules/clients/models/clientMembers.model.js";
import ClientPayment from "../src/modules/clients/models/clientPayment.model.js";
import ClientReminder from "../src/modules/clients/models/clientReminder.model.js";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ClientVehicle from "../src/modules/clients/models/clientVehicles.model.js";
import { getClientDetails } from "../src/modules/clients/services/clientDetail.service.js";
import { getClientDetailsParamsSchema } from "../src/modules/clients/validators/clientParams.validator.js";
import User from "../src/modules/user/models/user.model.js";

const RELATED_MODELS = [
  ClientCompany,
  ClientMember,
  ClientVehicle,
  ClientDriver,
  ClientService,
  ClientDocument,
  ClientPayment,
  ClientReminder,
];

const TOKEN_CONFIG = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  cookieSecure: false,
  issuer: "insurance-crm",
  audience: "insurance-crm-web",
};

test("validates the Client detail MongoDB identifier", () => {
  const validId = new mongoose.Types.ObjectId().toString();
  assert.equal(getClientDetailsParamsSchema.validate({ id: validId }).error, undefined);

  const { error } = getClientDetailsParamsSchema.validate({ id: "client-1" });
  assert.equal(error.details[0].path.join("."), "id");
});

test("does not query related collections when the Client does not exist", async () => {
  const originalFindById = Client.findById;
  Client.findById = () => ({ async exec() { return null; } });

  try {
    await assert.rejects(getClientDetails(new mongoose.Types.ObjectId().toString()), {
      code: "CLIENT_NOT_FOUND",
      status: 404,
    });
  } finally {
    Client.findById = originalFindById;
  }
});

test("serves one Client with records from every related Client model", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const clientId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalClientFindById = Client.findById;
  const originalRelatedFinds = new Map(
    RELATED_MODELS.map((Model) => [Model, Model.find])
  );
  const capturedSorts = new Map();
  const recordsByModel = new Map([
    [
      ClientCompany,
      [new ClientCompany({ client: clientId, companyName: "Example LLC" })],
    ],
    [ClientMember, [new ClientMember({ client: clientId, name: "Member" })]],
    [ClientVehicle, [new ClientVehicle({ client: clientId, tcNumber: "TC-1" })]],
    [ClientDriver, [new ClientDriver({ client: clientId, name: "Driver" })]],
    [ClientService, [new ClientService({ client: clientId, status: "Pending" })]],
    [ClientDocument, [new ClientDocument({ client: clientId, documentTitle: "File" })]],
    [ClientPayment, [new ClientPayment({ client: clientId, paymentStatus: "Unpaid" })]],
    [ClientReminder, [new ClientReminder({ client: clientId, priority: "High" })]],
  ]);

  User.findById = () => ({
    async exec() {
      return {
        _id: { toString: () => "user-123" },
        name: "Admin",
        email: "admin@example.test",
        role: "ADMIN",
        status: "ACTIVE",
        version: 0,
      };
    },
  });
  Client.findById = (id) => ({
    async exec() {
      assert.equal(id, clientId.toString());
      return new Client({ _id: clientId, name: "Example Client" });
    },
  });

  for (const Model of RELATED_MODELS) {
    Model.find = (filter) => {
      assert.deepEqual(filter, { client: clientId.toString() });
      return {
        sort(value) {
          capturedSorts.set(Model, value);
          return this;
        },
        async exec() {
          return recordsByModel.get(Model);
        },
      };
    };
  }

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const tokens = issueTokenPair(
    { id: "user-123", role: "ADMIN" },
    "session-123",
    TOKEN_CONFIG
  );

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/v1/client/${clientId}`,
      { headers: { Cookie: `accessToken=${tokens.accessToken}` } }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.data.client.id, clientId.toString());
    assert.deepEqual(Object.keys(body.data), [
      "client",
      "companies",
      "members",
      "vehicles",
      "drivers",
      "services",
      "documents",
      "payments",
      "reminders",
    ]);
    for (const key of Object.keys(body.data).slice(1)) {
      assert.equal(body.data[key].length, 1, key);
    }
    for (const Model of RELATED_MODELS) {
      assert.deepEqual(capturedSorts.get(Model), { createdAt: -1, _id: 1 });
    }
  } finally {
    User.findById = originalUserFindById;
    Client.findById = originalClientFindById;
    for (const [Model, find] of originalRelatedFinds) Model.find = find;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
