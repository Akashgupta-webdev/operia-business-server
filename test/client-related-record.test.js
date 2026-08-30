import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientDriver from "../src/modules/clients/models/clientDrivers.model.js";
import ClientMember from "../src/modules/clients/models/clientMembers.model.js";
import ClientVehicle from "../src/modules/clients/models/clientVehicles.model.js";
import {
  createClientDriverSchema,
  createClientMemberSchema,
  createClientVehicleSchema,
  deleteClientRelatedRecordQuerySchema,
  updateClientDriverSchema,
  updateClientMemberSchema,
  updateClientVehicleSchema,
} from "../src/modules/clients/validators/clientRelatedRecord.validator.js";
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

test("validates related-record updates and the delete selector", () => {
  const member = updateClientMemberSchema.validate({
    name: "  Example Member  ",
    memberType: "Director",
  });
  const vehicle = updateClientVehicleSchema.validate({
    policyNumber: "  POLICY-1  ",
    insuranceExpiry: "31-12-2030",
  });
  const driver = updateClientDriverSchema.validate({
    name: null,
    licenceExpiryDate: "30-11-2030",
  });
  const deletion = deleteClientRelatedRecordQuerySchema.validate({
    _id: new mongoose.Types.ObjectId().toString(),
    actionOn: "vehicle",
  });

  assert.equal(member.error, undefined);
  assert.equal(member.value.name, "Example Member");
  assert.equal(vehicle.error, undefined);
  assert.equal(vehicle.value.policyNumber, "POLICY-1");
  assert.equal(driver.error, undefined);
  assert.equal(deletion.error, undefined);
});

test("validates standalone Member, Vehicle, and Driver creation bodies", () => {
  const member = createClientMemberSchema.validate({
    memberType: "Partner",
    name: "  Example Member  ",
  });
  const vehicle = createClientVehicleSchema.validate({
    registrationNumer: "  DXB-A-100  ",
    registrationExpiry: "31-12-2030",
  });
  const driver = createClientDriverSchema.validate({
    name: "  Example Driver  ",
    licenceExpiryDate: "30-11-2030",
  });

  assert.equal(member.error, undefined);
  assert.equal(member.value.name, "Example Member");
  assert.equal(vehicle.error, undefined);
  assert.equal(vehicle.value.registrationNumer, "DXB-A-100");
  assert.equal(driver.error, undefined);
  assert.equal(driver.value.name, "Example Driver");

  assert.ok(createClientMemberSchema.validate({}).error);
  assert.ok(createClientVehicleSchema.validate({ client: "unsafe" }).error);
  assert.ok(
    createClientDriverSchema.validate({ licenceIssueDate: "2030-12-31" })
      .error
  );
});

test("rejects empty updates, server-owned fields, and unsafe delete selectors", () => {
  assert.ok(updateClientMemberSchema.validate({}).error);
  assert.ok(updateClientVehicleSchema.validate({ client: "unsafe" }).error);
  assert.ok(updateClientDriverSchema.validate({ licenceExpiryDate: "2030-12-31" }).error);
  assert.ok(
    deleteClientRelatedRecordQuerySchema.validate({
      _id: new mongoose.Types.ObjectId().toString(),
      actionOn: "payments",
    }).error
  );
});

test("serves all three related-record creation routes", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const clientId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalClientExists = Client.exists;
  const originalMemberCreate = ClientMember.create;
  const originalVehicleCreate = ClientVehicle.create;
  const originalDriverCreate = ClientDriver.create;
  const createdPayloads = new Map();

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
  const stubCreate = (Model, actionOn) => async (payload) => {
    createdPayloads.set(actionOn, payload);
    const record = new Model(payload);
    record.set("version", 0);
    return record;
  };
  ClientMember.create = stubCreate(ClientMember, "member");
  ClientVehicle.create = stubCreate(ClientVehicle, "vehicle");
  ClientDriver.create = stubCreate(ClientDriver, "driver");

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
    const requests = [
      ["member", { memberType: "Director", name: "New Member" }],
      ["vehicle", { policyNumber: "POLICY-1" }],
      ["driver", { name: "New Driver" }],
    ];

    for (const [type, body] of requests) {
      const response = await fetch(`${baseUrl}/${clientId}/${type}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const responseBody = await response.json();

      assert.equal(response.status, 201);
      assert.equal(response.headers.get("etag"), '"0"');
      assert.equal(responseBody.data.client, clientId.toString());
      assert.equal(
        response.headers.get("location"),
        `/api/v1/client/${type}/${responseBody.data.id}`
      );
      assert.equal(createdPayloads.get(type).client, clientId.toString());
    }
  } finally {
    User.findById = originalUserFindById;
    Client.exists = originalClientExists;
    ClientMember.create = originalMemberCreate;
    ClientVehicle.create = originalVehicleCreate;
    ClientDriver.create = originalDriverCreate;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test("serves all three update routes and the action-based delete route", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const memberId = new mongoose.Types.ObjectId();
  const vehicleId = new mongoose.Types.ObjectId();
  const driverId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalMemberFindById = ClientMember.findById;
  const originalVehicleFindById = ClientVehicle.findById;
  const originalDriverFindById = ClientDriver.findById;
  const originalDriverFindByIdAndDelete = ClientDriver.findByIdAndDelete;

  const member = new ClientMember({ _id: memberId, client: new mongoose.Types.ObjectId(), name: "Old" });
  const vehicle = new ClientVehicle({ _id: vehicleId, client: new mongoose.Types.ObjectId(), policyNumber: "OLD" });
  const driver = new ClientDriver({ _id: driverId, client: new mongoose.Types.ObjectId(), name: "Old" });
  for (const record of [member, vehicle, driver]) {
    record.set("version", 0);
    record.save = async () => {
      record.version += 1;
      return record;
    };
  }

  User.findById = () => ({ async exec() { return {
    _id: { toString: () => "user-123" },
    role: "ADMIN",
    status: "ACTIVE",
    version: 0,
  }; } });
  ClientMember.findById = () => ({ async exec() { return member; } });
  ClientVehicle.findById = () => ({ async exec() { return vehicle; } });
  ClientDriver.findById = () => ({ async exec() { return driver; } });
  ClientDriver.findByIdAndDelete = (id) => ({ async exec() {
    assert.equal(id, driverId.toString());
    return driver;
  } });

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
    const requests = [
      ["member", memberId, { name: "Updated Member" }],
      ["vehicle", vehicleId, { policyNumber: "UPDATED" }],
      ["driver", driverId, { licenceExpiryDate: "31-12-2030" }],
    ];

    for (const [type, id, body] of requests) {
      const response = await fetch(`${baseUrl}/${type}/${id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(body),
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("etag"), '"1"');
    }

    const deleteResponse = await fetch(
      `${baseUrl}/related?_id=${driverId}&actionOn=driver`,
      { method: "DELETE", headers }
    );
    const deleteBody = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual(deleteBody.data, {
      id: driverId.toString(),
      actionOn: "driver",
    });
  } finally {
    User.findById = originalUserFindById;
    ClientMember.findById = originalMemberFindById;
    ClientVehicle.findById = originalVehicleFindById;
    ClientDriver.findById = originalDriverFindById;
    ClientDriver.findByIdAndDelete = originalDriverFindByIdAndDelete;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
