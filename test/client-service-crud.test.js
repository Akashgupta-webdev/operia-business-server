import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import {
  createClientService,
  deleteClientService,
  updateClientService,
} from "../src/modules/clients/services/clientService.service.js";
import {
  createClientServiceSchema,
  updateClientServiceSchema,
} from "../src/modules/clients/validators/clientService.validator.js";
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

test("validates Client Service create and partial update bodies", () => {
  const creation = createClientServiceSchema.validate({
    category: "Business Setup",
    package: "Mainland LLC Company Formation Package",
    status: "Pending",
    packagePrice: "1500.00",
    paymentStatus: "Unpaid",
    targetCompletionDate: "31-12-2030",
    notes: ["Initial consultation complete"],
  });
  const update = updateClientServiceSchema.validate({
    status: "In Progress",
    packagePrice: null,
    notes: null,
  });

  assert.equal(creation.error, undefined);
  assert.equal(creation.value.packagePrice, "1500.00");
  assert.equal(update.error, undefined);
  assert.equal(update.value.packagePrice, null);
});

test("rejects empty, unknown, and incorrectly formatted Service bodies", () => {
  assert.ok(createClientServiceSchema.validate({}).error);
  assert.ok(updateClientServiceSchema.validate({ client: "unsafe" }).error);
  assert.ok(
    updateClientServiceSchema.validate({
      packagePrice: "1.234",
      targetCompletionDate: "2030-12-31",
    }).error
  );
});

test("distinguishes a missing Client from a missing Client Service", async () => {
  const id = new mongoose.Types.ObjectId().toString();
  const originalClientExists = Client.exists;
  const originalServiceFindById = ClientService.findById;
  const originalServiceFindByIdAndDelete = ClientService.findByIdAndDelete;

  Client.exists = async () => null;
  ClientService.findById = () => ({ async exec() { return null; } });
  ClientService.findByIdAndDelete = () => ({ async exec() { return null; } });

  try {
    await assert.rejects(createClientService(id, { status: "Pending" }), {
      code: "CLIENT_NOT_FOUND",
      status: 404,
    });
    await assert.rejects(updateClientService(id, { status: "Pending" }), {
      code: "CLIENT_SERVICE_NOT_FOUND",
      status: 404,
    });
    await assert.rejects(deleteClientService(id), {
      code: "CLIENT_SERVICE_NOT_FOUND",
      status: 404,
    });
  } finally {
    Client.exists = originalClientExists;
    ClientService.findById = originalServiceFindById;
    ClientService.findByIdAndDelete = originalServiceFindByIdAndDelete;
  }
});

test("serves Client Service create, patch, and delete routes", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const clientId = new mongoose.Types.ObjectId();
  const serviceId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalClientExists = Client.exists;
  const originalServiceCreate = ClientService.create;
  const originalServiceFindById = ClientService.findById;
  const originalServiceFindByIdAndDelete = ClientService.findByIdAndDelete;
  const service = new ClientService({
    _id: serviceId,
    client: clientId,
    category: "Business Setup",
    status: "Pending",
  });
  let createdPayload;

  service.set("version", 0);
  service.save = async () => {
    service.version += 1;
    return service;
  };
  User.findById = () => ({
    async exec() {
      return {
        _id: { toString: () => "user-123" },
        role: "ADMIN",
        status: "ACTIVE",
        version: 0,
      };
    },
  });
  Client.exists = async (filter) => {
    assert.deepEqual(filter, { _id: clientId.toString() });
    return { _id: clientId };
  };
  ClientService.create = async (payload) => {
    createdPayload = payload;
    service.set(payload);
    return service;
  };
  ClientService.findById = (id) => ({
    async exec() {
      assert.equal(id, serviceId.toString());
      return service;
    },
  });
  ClientService.findByIdAndDelete = (id) => ({
    async exec() {
      assert.equal(id, serviceId.toString());
      return service;
    },
  });

  const server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  const { accessToken } = issueTokenPair(
    { id: "user-123", role: "ADMIN" },
    "session-123",
    TOKEN_CONFIG
  );
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/client`;
  const headers = {
    "Content-Type": "application/json",
    Cookie: `accessToken=${accessToken}`,
  };

  try {
    const createResponse = await fetch(`${baseUrl}/${clientId}/service`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        category: "Business Setup",
        status: "Pending",
        packagePrice: "1500.00",
      }),
    });
    const createBody = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.headers.get("etag"), '"0"');
    assert.equal(
      createResponse.headers.get("location"),
      `/api/v1/client/service/${serviceId}`
    );
    assert.equal(createdPayload.client, clientId.toString());
    assert.equal(createBody.data.id, serviceId.toString());

    const updateResponse = await fetch(`${baseUrl}/service/${serviceId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status: "In Progress",
        paymentStatus: "Partial",
      }),
    });
    const updateBody = await updateResponse.json();

    assert.equal(updateResponse.status, 200);
    assert.equal(updateResponse.headers.get("etag"), '"1"');
    assert.equal(updateBody.data.status, "In Progress");
    assert.equal(updateBody.data.paymentStatus, "Partial");

    const deleteResponse = await fetch(`${baseUrl}/service/${serviceId}`, {
      method: "DELETE",
      headers,
    });
    const deleteBody = await deleteResponse.json();

    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteBody.data, { id: serviceId.toString() });
  } finally {
    User.findById = originalUserFindById;
    Client.exists = originalClientExists;
    ClientService.create = originalServiceCreate;
    ClientService.findById = originalServiceFindById;
    ClientService.findByIdAndDelete = originalServiceFindByIdAndDelete;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
