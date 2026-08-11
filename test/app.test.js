import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import app from "../src/app.js";

let baseUrl;
let server;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("returns the standard error envelope for an unknown route", async () => {
  const response = await fetch(`${baseUrl}/does-not-exist`);
  const body = await response.json();
  const correlationId = response.headers.get("x-correlation-id");

  assert.equal(response.status, 404);
  assert.ok(correlationId);
  assert.equal(body.error.code, "ROUTE_NOT_FOUND");
  assert.equal(body.meta.correlationId, correlationId);
  assert.deepEqual(body.error.details, []);
});

test("accepts and returns a valid client correlation ID", async () => {
  const correlationId = "client-trace-123";
  const response = await fetch(`${baseUrl}/does-not-exist`, {
    headers: { "X-Correlation-Id": correlationId },
  });
  const body = await response.json();

  assert.equal(response.headers.get("x-correlation-id"), correlationId);
  assert.equal(body.meta.correlationId, correlationId);
});

test("does not expose parser internals for malformed JSON", async () => {
  const response = await fetch(`${baseUrl}/api/v1/example`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{invalid-json",
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error.code, "MALFORMED_REQUEST");
  assert.equal("stack" in body.error, false);
  assert.equal("body" in body.error, false);
});

test("reports degraded health while the database is disconnected", async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 503);
  assert.equal(body.data.status, "degraded");
  assert.equal(body.data.database.connected, false);
  assert.equal(body.meta.correlationId, response.headers.get("x-correlation-id"));
});
