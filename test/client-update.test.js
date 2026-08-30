import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Client from "../src/modules/clients/models/client.model.js";
import { updateClientInformation } from "../src/modules/clients/services/clientUpdate.service.js";
import { updateClientInformationSchema } from "../src/modules/clients/validators/clientBody.validator.js";
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

test("validates and normalizes editable Client information", () => {
  const { error, value } = updateClientInformationSchema.validate({
    emailAddress: "  CLIENT@EXAMPLE.COM  ",
    nationality: "United Arab Emirates",
    clientType: "COMPANY",
    status: "Active",
    preferredCommunicationMethod: "Whatsapp",
    passport: {
      passportNumber: "a1234567",
      passportExpiryDate: "31-12-2030",
    },
  });

  assert.equal(error, undefined);
  assert.equal(value.emailAddress, "client@example.com");
  assert.equal(value.passport.passportNumber, "A1234567");
});

test("rejects empty, immutable, and invalid-select Client updates", () => {
  const emptyResult = updateClientInformationSchema.validate({});
  const invalidResult = updateClientInformationSchema.validate(
    { _id: new mongoose.Types.ObjectId().toString(), status: "ACTIVE" },
    { abortEarly: false }
  );

  assert.ok(emptyResult.error);
  assert.deepEqual(
    invalidResult.error.details.map(({ path }) => path.join(".")).sort(),
    ["_id", "status"]
  );
});

test("updates Client information through the service and increments its version", async () => {
  const clientId = new mongoose.Types.ObjectId();
  const originalFindById = Client.findById;
  const client = new Client({
    _id: clientId,
    name: "Old Name",
    emailAddress: "old@example.com",
  });
  client.set("version", 0);
  let lookupId;

  client.save = async () => {
    client.version += 1;
    return client;
  };
  Client.findById = (id) => ({
    async exec() {
      lookupId = id;
      return client;
    },
  });

  try {
    const result = await updateClientInformation(clientId.toString(), {
      name: "Updated Name",
    });

    assert.equal(lookupId, clientId.toString());
    assert.equal(result.name, "Updated Name");
    assert.equal(result.version, 1);
  } finally {
    Client.findById = originalFindById;
  }
});

test("serves PATCH /api/v1/client/:id for an Admin", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const clientId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalClientFindById = Client.findById;
  const client = new Client({
    _id: clientId,
    name: "Old Name",
    emailAddress: "old@example.com",
  });
  client.set("version", 0);

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
  Client.findById = () => ({ async exec() { return client; } });
  client.save = async () => {
    client.version += 1;
    return client;
  };

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
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `accessToken=${tokens.accessToken}`,
        },
        body: JSON.stringify({
          name: "Updated Name",
          emailAddress: "UPDATED@EXAMPLE.COM",
          preferredCommunicationMethod: "Email",
        }),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("etag"), '"1"');
    assert.equal(body.data.id, clientId.toString());
    assert.equal(body.data.name, "Updated Name");
    assert.equal(body.data.emailAddress, "updated@example.com");
    assert.equal(body.data.preferredCommunicationMethod, "Email");
  } finally {
    User.findById = originalUserFindById;
    Client.findById = originalClientFindById;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
