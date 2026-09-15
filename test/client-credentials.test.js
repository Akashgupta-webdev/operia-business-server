import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import User from "../src/modules/user/models/user.model.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import { updateClientCredentials } from "../src/modules/clients/services/clientCredentials.service.js";
import { updateClientCredentialsSchema } from "../src/modules/clients/validators/clientCredentials.validator.js";
import { updateClientInformationSchema } from "../src/modules/clients/validators/clientBody.validator.js";

const config = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900, refreshTokenTtlSeconds: 604800,
  cookieSecure: false, issuer: "insurance-crm", audience: "insurance-crm-web",
};

test("credential validation rejects unsafe bodies and oversized passwords", () => {
  for (const body of [undefined, {}, { password: null }, { password: "short" },
    { password: "\u00e9".repeat(37) }, { emailAddress: null }, { emailAddress: "bad" },
    { name: "Unexpected" }, { password: "x".repeat(73) }]) {
    assert.ok(updateClientCredentialsSchema.validate(body).error);
  }
  assert.equal(updateClientCredentialsSchema.validate({ password: "\u00e9".repeat(36) }).error, undefined);
  assert.ok(updateClientInformationSchema.validate({ password: "new-password" }).error);
  assert.equal(Client.schema.path("password").options.select, false);
  assert.equal(new Client({ name: "Legacy" }).validateSync(), undefined);
  assert.equal(new Client({ password: "plaintext" }).validateSync(), undefined);
});

test("credential API protects access, stores plain-text passwords, preserves omitted values and handles failures", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = config.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = config.refreshTokenSecret;
  const client = new Client({ _id: new mongoose.Types.ObjectId(), emailAddress: "old@example.com", version: 0 });
  let role = "ADMIN";
  let found = true;
  let failSave = false;
  let lookups = 0;
  const oldClientFind = Client.findById;
  const oldUserFind = User.findById;
  Client.findById = () => ({ async exec() { lookups++; return found ? client : null; } });
  User.findById = () => ({ async exec() { return { _id: "user-123", role, status: "ACTIVE" }; } });
  client.save = async () => {
    if (failSave) throw new Error("database failure");
    await client.validate();
    client.version++;
    return client;
  };
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  const tokens = issueTokenPair({ id: "user-123", role: "ADMIN" }, "session-123", config);
  // Sends requests through real authentication, authorization, validation, and controller middleware.
  // Only persistence is stubbed so the suite requires no external MongoDB service.
  async function request(body, authenticated = true, id = client.id) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/client/${id}/credentials`, {
      method: "PATCH", headers: { "Content-Type": "application/json", ...(authenticated ? { Cookie: `accessToken=${tokens.accessToken}` } : {}) },
      body: JSON.stringify(body),
    });
    return { response, body: await response.json() };
  }
  try {
    assert.equal((await request({ password: "new-password" }, false)).response.status, 401);
    role = "AGENT";
    assert.equal((await request({ password: "new-password" })).response.status, 403);
    assert.equal(lookups, 0);
    role = "ADMIN";
    const invalid = await request({ password: "secret" });
    assert.equal(invalid.response.status, 422);
    assert.ok(!JSON.stringify(invalid.body).includes("secret"));
    assert.equal((await request({ password: "new-password" }, true, "bad-id")).response.status, 422);
    const result = await request({ emailAddress: " NEW@EXAMPLE.COM ", password: " new-password " });
    assert.equal(result.response.status, 200);
    assert.equal(result.response.headers.get("etag"), '"1"');
    assert.equal(result.body.data.emailAddress, "new@example.com");
    assert.equal(result.body.data.password, undefined);
    assert.equal(client.toObject().password, undefined);
    assert.equal(client.password, " new-password ");
    const originalPassword = client.password;
    await request({ emailAddress: "other@example.com" });
    assert.equal(client.password, originalPassword);
    await request({ password: "replacement-password" });
    assert.equal(client.emailAddress, "other@example.com");
    assert.equal(client.password, "replacement-password");
    assert.notEqual(client.password, originalPassword);
    found = false;
    const missing = await request({ emailAddress: "missing@example.com" });
    assert.equal(missing.response.status, 404);
    assert.equal(missing.body.error.code, "CLIENT_NOT_FOUND");
    found = true;
    failSave = true;
    assert.equal((await request({ emailAddress: "fail@example.com" })).response.status, 500);
    await assert.rejects(updateClientCredentials(client.id, { password: "short" }), { code: "VALIDATION_FAILED" });
  } finally {
    Client.findById = oldClientFind;
    User.findById = oldUserFind;
    await new Promise(resolve => server.close(resolve));
  }
});

