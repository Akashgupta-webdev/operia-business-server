import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import app from "../src/app.js";
import { issueTokenPair } from "../src/modules/authentication/services/token.service.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import { updateClientCompanyInformation } from "../src/modules/clients/services/clientCompanyUpdate.service.js";
import { updateClientCompanyInformationSchema } from "../src/modules/clients/validators/clientCompanyBody.validator.js";
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

test("validates editable Client Company information", () => {
  const { error, value } = updateClientCompanyInformationSchema.validate({
    companyName: "  Example Trading LLC  ",
    tradeLicenceNumber: "  TL-1001  ",
    licenceExpiryDate: "31-12-2030",
    vatTaxRegistrationNumber: null,
    corporateTaxNumber: "CT-1001",
  });

  assert.equal(error, undefined);
  assert.equal(value.companyName, "Example Trading LLC");
  assert.equal(value.tradeLicenceNumber, "TL-1001");
  assert.equal(value.vatTaxRegistrationNumber, null);
});

test("rejects empty, server-owned, and invalid-date Company updates", () => {
  const emptyResult = updateClientCompanyInformationSchema.validate({});
  const invalidResult = updateClientCompanyInformationSchema.validate(
    {
      client: new mongoose.Types.ObjectId().toString(),
      licenceExpiryDate: "2030-12-31",
    },
    { abortEarly: false }
  );

  assert.ok(emptyResult.error);
  assert.deepEqual(
    invalidResult.error.details.map(({ path }) => path.join(".")).sort(),
    ["client", "licenceExpiryDate"]
  );
});

test("updates the Company associated with a Client through the service", async () => {
  const clientId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const originalClientExists = Client.exists;
  const originalCompanyFindOne = ClientCompany.findOne;
  const company = new ClientCompany({
    _id: companyId,
    client: clientId,
    companyName: "Old Company",
  });
  let companyFilter;

  company.set("version", 0);
  company.save = async () => {
    company.version += 1;
    return company;
  };
  Client.exists = async (filter) => {
    assert.deepEqual(filter, { _id: clientId.toString() });
    return { _id: clientId };
  };
  ClientCompany.findOne = (filter) => {
    companyFilter = filter;
    return { async exec() { return company; } };
  };

  try {
    const result = await updateClientCompanyInformation(clientId.toString(), {
      companyName: "Updated Company",
    });

    assert.deepEqual(companyFilter, { client: clientId.toString() });
    assert.equal(result.companyName, "Updated Company");
    assert.equal(result.version, 1);
  } finally {
    Client.exists = originalClientExists;
    ClientCompany.findOne = originalCompanyFindOne;
  }
});

test("distinguishes a missing Client from a missing Client Company", async () => {
  const clientId = new mongoose.Types.ObjectId().toString();
  const originalClientExists = Client.exists;
  const originalCompanyFindOne = ClientCompany.findOne;
  let companyWasQueried = false;

  Client.exists = async () => null;
  ClientCompany.findOne = () => {
    companyWasQueried = true;
    return { async exec() { return null; } };
  };

  try {
    await assert.rejects(updateClientCompanyInformation(clientId, {}), {
      code: "CLIENT_NOT_FOUND",
      status: 404,
    });
    assert.equal(companyWasQueried, false);

    Client.exists = async () => ({ _id: clientId });
    await assert.rejects(updateClientCompanyInformation(clientId, {}), {
      code: "CLIENT_COMPANY_NOT_FOUND",
      status: 404,
    });
  } finally {
    Client.exists = originalClientExists;
    ClientCompany.findOne = originalCompanyFindOne;
  }
});

test("serves PATCH /api/v1/client/:id/company for an Admin", async () => {
  process.env.AUTH_ACCESS_TOKEN_SECRET = TOKEN_CONFIG.accessTokenSecret;
  process.env.AUTH_REFRESH_TOKEN_SECRET = TOKEN_CONFIG.refreshTokenSecret;

  const clientId = new mongoose.Types.ObjectId();
  const companyId = new mongoose.Types.ObjectId();
  const originalUserFindById = User.findById;
  const originalClientExists = Client.exists;
  const originalCompanyFindOne = ClientCompany.findOne;
  const company = new ClientCompany({
    _id: companyId,
    client: clientId,
    companyName: "Old Company",
  });

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
  Client.exists = async () => ({ _id: clientId });
  ClientCompany.findOne = () => ({ async exec() { return company; } });
  company.set("version", 0);
  company.save = async () => {
    company.version += 1;
    return company;
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
      `http://127.0.0.1:${server.address().port}/api/v1/client/${clientId}/company`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Cookie: `accessToken=${tokens.accessToken}`,
        },
        body: JSON.stringify({
          companyName: "Updated Company LLC",
          tradeLicenceNumber: "TL-2002",
          licenceExpiryDate: "31-12-2030",
        }),
      }
    );
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("etag"), '"1"');
    assert.equal(body.data.id, companyId.toString());
    assert.equal(body.data.client, clientId.toString());
    assert.equal(body.data.companyName, "Updated Company LLC");
    assert.equal(body.data.tradeLicenceNumber, "TL-2002");
  } finally {
    User.findById = originalUserFindById;
    Client.exists = originalClientExists;
    ClientCompany.findOne = originalCompanyFindOne;
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
