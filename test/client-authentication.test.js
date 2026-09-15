import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import app from "../src/app.js";
import Client from "../src/modules/clients/models/client.model.js";
import { getClientAuthenticationConfig } from "../src/modules/clients/services/clientAuthentication.service.js";
import { hashRefreshToken, issueTokenPair, verifyAccessToken, verifyRefreshToken } from "../src/modules/authentication/services/token.service.js";

// Exposes a minimal Mongoose query stub while preserving the service's query chaining.
// Persistence behavior is supplied by each test without requiring an external database.
function queryResult(resolve) {
  return { select() { return this; }, limit() { return this; }, async exec() { return resolve(); } };
}

test("Client login, session, refresh replay, account state and staff isolation", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = "access-secret-with-at-least-thirty-two-characters";
  process.env.AUTH_REFRESH_TOKEN_SECRET = "refresh-secret-with-at-least-thirty-two-characters";
  const client = new Client({ _id: new mongoose.Types.ObjectId(), name: "Client", emailAddress: "client@example.com", password: " portal-password ", version: 0 });
  let duplicate = false;
  let missing = false;
  let writeFailure = false;
  const original = { find: Client.find, findById: Client.findById, findOneAndUpdate: Client.findOneAndUpdate };
  Client.find = ({ emailAddress }) => queryResult(() => missing || emailAddress !== client.emailAddress ? [] : duplicate ? [client, client] : [client]);
  Client.findById = () => queryResult(() => missing ? null : client);
  Client.findOneAndUpdate = (filter, update) => queryResult(() => {
    if (writeFailure) throw new Error("Simulated database failure");
    if (missing || client.status !== filter.status ||
      (filter.refreshKeyHash !== undefined && filter.refreshKeyHash !== client.refreshKeyHash) ||
      (filter.version !== undefined && filter.version !== client.version)) return null;
    client.refreshKeyHash = update.$set.refreshKeyHash;
    client.version += update.$inc.version;
    return client;
  });
  const server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  // Exercises real route middleware, cookies, JWT verification, and service orchestration.
  // Only the Client database methods above are replaced for deterministic isolation.
  async function request(path, method = "GET", body, cookie) {
    return fetch(`http://127.0.0.1:${server.address().port}/api/v1${path}`, {
      method, headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  // Extracts the named cookie values from a response for subsequent browser-like requests.
  // Cookie attributes remain available separately for security-policy assertions.
  function cookies(response) {
    const header = response.headers.get("set-cookie") ?? "";
    return { access: header.match(/clientAccessToken=([^;,\s]+)/)?.[1], refresh: header.match(/clientRefreshToken=([^;,\s]+)/)?.[1] };
  }
  const credentials = { emailAddress: " CLIENT@EXAMPLE.COM ", password: " portal-password " };
  try {
    for (const body of [{}, { emailAddress: "bad", password: "short" }, { ...credentials, role: "ADMIN" }, { emailAddress: credentials.emailAddress }, { ...credentials, password: null }, { ...credentials, password: { $ne: null } }]) {
      assert.equal((await request("/login", "POST", body)).status, 422);
    }
    assert.equal((await request("/session")).status, 401);
    const noRefresh = await request("/refresh-token", "POST");
    assert.equal((await noRefresh.json()).error.code, "REFRESH_TOKEN_REQUIRED");
    assert.equal((await request("/login", "POST", { ...credentials, password: "wrong-password" })).status, 401);
    duplicate = true;
    assert.equal((await request("/login", "POST", credentials)).status, 401);
    duplicate = false;
    missing = true;
    assert.equal((await request("/login", "POST", credentials)).status, 401);
    missing = false;
    for (const status of ["Inactive", "Archived", "Draft"]) {
      client.status = status;
      assert.equal((await request("/login", "POST", credentials)).status, 401);
    }
    client.status = "Active";
    const login = await request("/login", "POST", credentials);
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("cache-control"), "no-store");
    assert.match(login.headers.get("set-cookie"), /HttpOnly/);
    assert.match(login.headers.get("set-cookie"), /SameSite=Strict/);
    const body = await login.json();
    assert.equal(body.data.role, "CLIENT");
    assert.equal(body.data.emailAddress, "client@example.com");
    assert.equal(body.data.password, undefined);
    assert.equal(body.data.refreshKeyHash, undefined);
    assert.equal(client.toJSON().refreshKeyHash, undefined);
    assert.equal(client.toObject().refreshKeyHash, undefined);
    assert.equal(Client.schema.path("refreshKeyHash").options.select, false);
    const initial = cookies(login);
    assert.equal(client.refreshKeyHash, hashRefreshToken(initial.refresh));
    assert.equal(verifyAccessToken(initial.access, getClientAuthenticationConfig()).role, "CLIENT");
    assert.throws(() => verifyAccessToken(initial.access), { code: "INVALID_SESSION" });
    assert.throws(() => verifyRefreshToken(initial.refresh), { code: "INVALID_SESSION" });
    const session = await request("/session", "GET", undefined, `clientAccessToken=${initial.access}`);
    assert.equal(session.status, 200);
    assert.equal(session.headers.get("set-cookie"), null);
    assert.equal((await request("/auth/session", "GET", undefined, `accessToken=${initial.access}`)).status, 401);
    const staff = issueTokenPair({ id: client.id, role: "ADMIN" });
    assert.equal((await request("/session", "GET", undefined, `clientAccessToken=${staff.accessToken}`)).status, 401);
    assert.equal((await request("/refresh-token", "POST", undefined, `clientRefreshToken=${staff.refreshToken}`)).status, 401);
    const concurrent = await Promise.all([
      request("/refresh-token", "POST", undefined, `clientRefreshToken=${initial.refresh}`),
      request("/refresh-token", "POST", undefined, `clientRefreshToken=${initial.refresh}`),
    ]);
    assert.deepEqual(concurrent.map(r => r.status).sort(), [200, 401]);
    const rotated = cookies(concurrent.find(r => r.status === 200));
    assert.notEqual(rotated.refresh, initial.refresh);
    const expired = issueTokenPair({ id: client.id, role: "CLIENT" }, undefined, { ...getClientAuthenticationConfig(), accessTokenTtlSeconds: -1 });
    const automatic = await request("/session", "GET", undefined, `clientAccessToken=${expired.accessToken}; clientRefreshToken=${rotated.refresh}`);
    assert.equal(automatic.status, 200);
    const autoCookies = cookies(automatic);
    assert.ok(autoCookies.refresh);
    const relogin = await request("/login", "POST", credentials);
    assert.equal(relogin.status, 200);
    assert.equal((await request("/refresh-token", "POST", undefined, `clientRefreshToken=${autoCookies.refresh}`)).status, 401);
    const latest = cookies(relogin);
    client.status = "Inactive";
    assert.equal((await request("/session", "GET", undefined, `clientAccessToken=${latest.access}`)).status, 401);
    assert.equal((await request("/refresh-token", "POST", undefined, `clientRefreshToken=${latest.refresh}`)).status, 401);
    client.status = "Active";
    writeFailure = true;
    const failed = await request("/login", "POST", credentials);
    assert.equal(failed.status, 500);
    assert.equal(failed.headers.get("set-cookie"), null);
  } finally {
    Object.assign(Client, original);
    await new Promise(resolve => server.close(resolve));
  }
});
