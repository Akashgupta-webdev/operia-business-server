import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import app from "../src/app.js";
import { getAuthenticationConfig } from "../src/config/authentication.js";
import { AuthenticationError } from "../src/modules/authentication/errors/authentication.error.js";
import { setAuthenticationCookies } from "../src/modules/authentication/controllers/authentication.controller.js";
import {
  hashRefreshToken,
  issueTokenPair,
  refreshTokenMatches,
  verifyAccessToken,
  verifyRefreshToken,
} from "../src/modules/authentication/services/token.service.js";
import User, { hashAccessKey } from "../src/modules/user/models/user.model.js";

const tokenConfig = {
  accessTokenSecret: "access-secret-with-at-least-thirty-two-characters",
  refreshTokenSecret: "refresh-secret-with-at-least-thirty-two-characters",
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 604800,
  cookieSecure: false,
  issuer: "insurance-crm",
  audience: "insurance-crm-web",
};

let baseUrl;
let server;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("issues and verifies typed access and refresh tokens", () => {
  const tokens = issueTokenPair(
    { id: "user-123", role: "AGENT" },
    "session-123",
    tokenConfig
  );
  const accessPayload = verifyAccessToken(tokens.accessToken, tokenConfig);
  const refreshPayload = verifyRefreshToken(tokens.refreshToken, tokenConfig);

  assert.equal(accessPayload.sub, "user-123");
  assert.equal(accessPayload.type, "access");
  assert.equal(refreshPayload.sub, "user-123");
  assert.equal(refreshPayload.type, "refresh");
  assert.equal(refreshPayload.sid, "session-123");
  assert.equal(
    refreshTokenMatches(tokens.refreshToken, hashRefreshToken(tokens.refreshToken)),
    true
  );
  assert.equal(refreshTokenMatches("replayed-token", hashRefreshToken(tokens.refreshToken)), false);
});

test("does not accept a refresh token as an access token", () => {
  const { refreshToken } = issueTokenPair(
    { id: "user-123", role: "AGENT" },
    "session-123",
    tokenConfig
  );

  assert.throws(
    () => verifyAccessToken(refreshToken, tokenConfig),
    (error) => error instanceof AuthenticationError && error.code === "INVALID_SESSION"
  );
});

test("validates authentication secrets and token lifetimes", () => {
  assert.throws(
    () => getAuthenticationConfig({ AUTH_ACCESS_TOKEN_SECRET: "short" }),
    /AUTH_ACCESS_TOKEN_SECRET/
  );

  const config = getAuthenticationConfig({
    AUTH_ACCESS_TOKEN_SECRET: tokenConfig.accessTokenSecret,
    AUTH_REFRESH_TOKEN_SECRET: tokenConfig.refreshTokenSecret,
    AUTH_ACCESS_TOKEN_TTL_SECONDS: "60",
    AUTH_REFRESH_TOKEN_TTL_SECONDS: "120",
    NODE_ENV: "production",
  });

  assert.equal(config.accessTokenTtlSeconds, 60);
  assert.equal(config.refreshTokenTtlSeconds, 120);
  assert.equal(config.cookieSecure, true);
});

test("uses secure cross-site authentication cookies in production", () => {
  const originalEnvironment = {
    NODE_ENV: process.env.NODE_ENV,
    AUTH_ACCESS_TOKEN_SECRET: process.env.AUTH_ACCESS_TOKEN_SECRET,
    AUTH_REFRESH_TOKEN_SECRET: process.env.AUTH_REFRESH_TOKEN_SECRET,
  };
  const cookies = [];
  const response = {
    cookie(name, value, options) {
      cookies.push({ name, value, options });
    },
  };

  process.env.NODE_ENV = "production";
  process.env.AUTH_ACCESS_TOKEN_SECRET = tokenConfig.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = tokenConfig.refreshTokenSecret;

  try {
    setAuthenticationCookies(response, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }

  assert.equal(cookies.length, 2);
  for (const { options } of cookies) {
    assert.equal(options.httpOnly, true);
    assert.equal(options.secure, true);
    assert.equal(options.sameSite, "none");
    assert.equal(options.path, "/");
  }
});

test("rejects invalid login request fields", async () => {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessKey: "short", email: "not-accepted@example.test" }),
  });
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error.code, "VALIDATION_FAILED");
  assert.deepEqual(
    body.error.details.map(({ field }) => field).sort(),
    ["accessKey", "email"]
  );
});

test("requires cookies for refresh, session, and current-user endpoints", async () => {
  const [refreshResponse, sessionResponse, meResponse] = await Promise.all([
    fetch(`${baseUrl}/api/v1/auth/refresh-token`, { method: "POST" }),
    fetch(`${baseUrl}/api/v1/auth/session`),
    fetch(`${baseUrl}/api/v1/me`),
  ]);
  const refreshBody = await refreshResponse.json();
  const sessionBody = await sessionResponse.json();
  const meBody = await meResponse.json();

  assert.equal(refreshResponse.status, 401);
  assert.equal(refreshBody.error.code, "REFRESH_TOKEN_REQUIRED");
  assert.equal(sessionResponse.status, 401);
  assert.equal(sessionBody.error.code, "AUTHENTICATION_REQUIRED");
  assert.equal(meResponse.status, 401);
  assert.equal(meBody.error.code, "AUTHENTICATION_REQUIRED");
});

test("logs in, returns the current user, auto-refreshes, and rejects replay", async () => {
  const originalFindOne = User.findOne;
  const originalFindById = User.findById;
  const originalAccessSecret = process.env.AUTH_ACCESS_TOKEN_SECRET;
  const originalRefreshSecret = process.env.AUTH_REFRESH_TOKEN_SECRET;
  const submittedAccessKey = "a".repeat(12);
  let queriedAccessKey;
  const user = {
    _id: { toString: () => "user-123" },
    name: "Agent Name",
    email: "agent@example.test",
    role: "AGENT",
    status: "ACTIVE",
    version: 0,
    refreshKeyHash: undefined,
    async save() {
      this.version += 1;
    },
  };
  const queryReturning = (value) => ({
    select() {
      return this;
    },
    async exec() {
      return value;
    },
  });

  process.env.AUTH_ACCESS_TOKEN_SECRET = tokenConfig.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = tokenConfig.refreshTokenSecret;
  User.findOne = ({ accessKey }) => {
    queriedAccessKey = accessKey;
    return queryReturning(user);
  };
  User.findById = () => queryReturning(user);

  try {
    const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessKey: submittedAccessKey }),
    });
    const loginBody = await loginResponse.json();
    const loginCookies = loginResponse.headers.get("set-cookie");
    const accessCookie = loginCookies.match(/accessToken=([^;,\s]+)/)?.[1];
    const refreshCookie = loginCookies.match(/refreshToken=([^;,\s]+)/)?.[1];

    assert.equal(loginResponse.status, 200);
    assert.equal(queriedAccessKey, hashAccessKey(submittedAccessKey));
    assert.equal(loginBody.data.id, "user-123");
    assert.equal(loginBody.data.accessKey, undefined);
    assert.match(loginCookies, /accessToken=/);
    assert.match(loginCookies, /refreshToken=/);
    assert.match(loginCookies, /HttpOnly/i);
    assert.match(loginCookies, /SameSite=Strict/i);
    assert.ok(accessCookie);
    assert.ok(refreshCookie);

    const meResponse = await fetch(`${baseUrl}/api/v1/me`, {
      headers: { Cookie: `accessToken=${accessCookie}` },
    });
    const meBody = await meResponse.json();

    assert.equal(meResponse.status, 200);
    assert.deepEqual(meBody.data, {
      id: "user-123",
      name: "Agent Name",
      email: "agent@example.test",
      role: "AGENT",
      status: "ACTIVE",
      version: 1,
    });
    assert.equal(
      meBody.meta.correlationId,
      meResponse.headers.get("x-correlation-id")
    );

    const refreshedResponse = await fetch(`${baseUrl}/api/v1/auth/session`, {
      headers: { Cookie: `refreshToken=${refreshCookie}` },
    });
    const refreshedCookies = refreshedResponse.headers.get("set-cookie");

    assert.equal(refreshedResponse.status, 200);
    assert.match(refreshedCookies, /accessToken=/);
    assert.match(refreshedCookies, /refreshToken=/);

    const replayResponse = await fetch(`${baseUrl}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: { Cookie: `refreshToken=${refreshCookie}` },
    });
    const replayBody = await replayResponse.json();

    assert.equal(replayResponse.status, 401);
    assert.equal(replayBody.error.code, "INVALID_SESSION");
  } finally {
    User.findOne = originalFindOne;
    User.findById = originalFindById;

    if (originalAccessSecret === undefined) {
      delete process.env.AUTH_ACCESS_TOKEN_SECRET;
    } else {
      process.env.AUTH_ACCESS_TOKEN_SECRET = originalAccessSecret;
    }

    if (originalRefreshSecret === undefined) {
      delete process.env.AUTH_REFRESH_TOKEN_SECRET;
    } else {
      process.env.AUTH_REFRESH_TOKEN_SECRET = originalRefreshSecret;
    }
  }
});
