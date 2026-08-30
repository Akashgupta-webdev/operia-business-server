import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import configureCloudinary from "../src/config/cloudinary.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientDriver from "../src/modules/clients/models/clientDrivers.model.js";
import ClientMember from "../src/modules/clients/models/clientMembers.model.js";
import ClientPayment from "../src/modules/clients/models/clientPayment.model.js";
import ClientReminder from "../src/modules/clients/models/clientReminder.model.js";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ClientVehicle from "../src/modules/clients/models/clientVehicles.model.js";
import { createClientAggregate } from "../src/modules/clients/services/clientCreation.service.js";
import {
  createClientPayloadSchema,
  validateCreateClient,
} from "../src/modules/clients/validators/clientBody.validator.js";

// Restores Cloudinary environment variables and refreshes the SDK's cached configuration.
// Tests use this helper so configuration scenarios cannot affect later upload assertions.
const restoreCloudinaryEnvironment = (originalEnvironment) => {
  for (const [key, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  const hasIndividualCredentials =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;
  if (process.env.CLOUDINARY_URL || hasIndividualCredentials) {
    configureCloudinary();
    return;
  }

  process.env.CLOUDINARY_URL = "cloudinary://cleanup-key:cleanup-secret@cleanup-cloud";
  configureCloudinary();
  delete process.env.CLOUDINARY_URL;
};

const completePayload = {
  client: {
    name: "Example Person",
    nationality: "India",
    clientType: "COMPANY",
    passport: { passportNumber: "A1234567" },
  },
  company: { companyName: "Example LLC" },
  members: [{ memberType: "Partner", name: "Example Partner" }],
  vehicles: [{ registrationNumer: "A-12345" }],
  drivers: [{ name: "Example Driver" }],
  services: [
    {
      category: "Business Setup",
      package: "Mainland LLC Company Formation Package",
      packagePrice: "1500.00",
      targetCompletionDate: "31-12-2026",
    },
  ],
  documents: [{ documentTitle: "Passport", documentType: "Passport" }],
  payments: [{ totalBilled: "1500.00", paymentStatus: "Unpaid" }],
  reminders: [{ followupDate: "20-12-2026", priority: "High" }],
};

test("validates a complete Client aggregate payload", () => {
  const { error, value } = createClientPayloadSchema.validate(completePayload, {
    abortEarly: false,
  });

  assert.equal(error, undefined);
  assert.equal(value.client.passport.passportNumber, "A1234567");
  assert.equal(value.services[0].packagePrice, "1500.00");
});

test("enforces Company conditions, date formats, and server-owned references", () => {
  const { error } = createClientPayloadSchema.validate(
    {
      client: { name: "Example Person", clientType: "INDIVIDUAL" },
      company: { companyName: "Forbidden LLC" },
      members: [{ client: new mongoose.Types.ObjectId(), name: "Member" }],
      services: [{ targetCompletionDate: "2026-12-31" }],
    },
    { abortEarly: false }
  );
  const fields = new Set(error.details.map((detail) => detail.path.join(".")));

  assert.equal(fields.has("company"), true);
  assert.equal(fields.has("members.0.client"), true);
  assert.equal(fields.has("services.0.targetCompletionDate"), true);
});

test("requires one document metadata item per uploaded file when metadata is supplied", async () => {
  const req = {
    body: { payload: JSON.stringify(completePayload) },
    files: [{ originalname: "one.pdf" }, { originalname: "two.pdf" }],
    is: () => "multipart/form-data",
  };

  const error = await new Promise((resolve) => {
    validateCreateClient(req, {}, resolve);
  });

  assert.equal(error.code, "VALIDATION_FAILED");
  assert.equal(error.details.some(({ field }) => field === "documents"), true);
});

test("reloads CLOUDINARY_URL when dotenv runs after the Cloudinary SDK import", () => {
  const originalEnvironment = {
    CLOUDINARY_URL: process.env.CLOUDINARY_URL,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  process.env.CLOUDINARY_URL =
    "cloudinary://late-api-key:late-api-secret@late-cloud";
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  try {
    const cloudinary = configureCloudinary();
    assert.equal(cloudinary.config("cloud_name"), "late-cloud");
    assert.equal(cloudinary.config("api_key"), "late-api-key");
    assert.equal(cloudinary.config("api_secret"), "late-api-secret");
  } finally {
    restoreCloudinaryEnvironment(originalEnvironment);
  }
});

test("rejects an incomplete CLOUDINARY_URL with the documented API error", () => {
  const originalEnvironment = {
    CLOUDINARY_URL: process.env.CLOUDINARY_URL,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };

  process.env.CLOUDINARY_URL = "cloudinary://api-key-only@missing-secret-cloud";
  delete process.env.CLOUDINARY_CLOUD_NAME;
  delete process.env.CLOUDINARY_API_KEY;
  delete process.env.CLOUDINARY_API_SECRET;

  try {
    assert.throws(configureCloudinary, {
      code: "UPLOAD_CONFIGURATION_ERROR",
      status: 500,
    });
  } finally {
    restoreCloudinaryEnvironment(originalEnvironment);
  }
});

test("creates every related record with the generated Client reference", async () => {
  const originalEnvironment = {
    CLOUDINARY_URL: process.env.CLOUDINARY_URL,
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
  };
  delete process.env.CLOUDINARY_URL;
  process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
  process.env.CLOUDINARY_API_KEY = "test-key";
  process.env.CLOUDINARY_API_SECRET = "test-secret";

  const cloudinary = configureCloudinary();
  const originalUploadStream = cloudinary.uploader.upload_stream;
  const originalDestroy = cloudinary.uploader.destroy;
  const originalStartSession = mongoose.startSession;
  const models = [
    Client,
    ClientCompany,
    ClientMember,
    ClientVehicle,
    ClientDriver,
    ClientService,
    ClientDocument,
    ClientPayment,
    ClientReminder,
  ];
  const originalCreates = new Map(models.map((Model) => [Model, Model.create]));
  const createdPayloads = new Map();
  const clientId = new mongoose.Types.ObjectId();
  const session = {
    ended: false,
    transactionCount: 0,
    async withTransaction(work) {
      this.transactionCount += 1;
      await work();
    },
    async endSession() {
      this.ended = true;
    },
  };

  cloudinary.uploader.upload_stream = (_options, callback) => ({
    end() {
      callback(null, {
        secure_url: "https://example.test/passport.pdf",
        public_id: "client/passport",
        resource_type: "raw",
      });
    },
  });
  cloudinary.uploader.destroy = async () => ({ result: "ok" });
  mongoose.startSession = async () => session;

  for (const Model of models) {
    Model.create = async (payloads) => {
      createdPayloads.set(Model, payloads);
      if (Model === Client) {
        return [{ _id: clientId, version: 0 }];
      }
      return payloads.map((payload) => ({
        ...payload,
        _id: new mongoose.Types.ObjectId(),
        version: 0,
      }));
    };
  }

  try {
    const result = await createClientAggregate(
      completePayload,
      [{ originalname: "passport.pdf", buffer: Buffer.from("test") }],
      "test-correlation-id"
    );

    assert.equal(session.transactionCount, 1);
    assert.equal(session.ended, true);
    assert.equal(result.documents[0].documentURL, "https://example.test/passport.pdf");

    for (const Model of models.slice(1)) {
      assert.equal(createdPayloads.get(Model)[0].client, clientId, Model.modelName);
    }
  } finally {
    cloudinary.uploader.upload_stream = originalUploadStream;
    cloudinary.uploader.destroy = originalDestroy;
    mongoose.startSession = originalStartSession;
    for (const [Model, create] of originalCreates) Model.create = create;

    restoreCloudinaryEnvironment(originalEnvironment);
  }
});
