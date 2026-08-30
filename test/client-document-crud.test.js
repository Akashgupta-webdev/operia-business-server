import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import configureCloudinary from "../src/config/cloudinary.js";
import ClientRoute from "../src/modules/clients/client.route.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import {
  addClientDocument,
  deleteClientDocument,
} from "../src/modules/clients/services/clientDocument.service.js";
import {
  createClientDocumentBodySchema,
  validateAddClientDocument,
} from "../src/modules/clients/validators/clientDocument.validator.js";

test("registers Client Document create and delete routes", () => {
  const registeredRoutes = ClientRoute.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: layer.route.methods,
    }));

  assert.ok(
    registeredRoutes.some(
      ({ path, methods }) => path === "/:id/document" && methods.post
    )
  );
  assert.ok(
    registeredRoutes.some(
      ({ path, methods }) => path === "/document/:id" && methods.delete
    )
  );
});

test("validates document metadata and requires one uploaded file", async () => {
  const validResult = createClientDocumentBodySchema.validate({
    documentTitle: "Passport copy",
    documentType: "Passport",
    issueDate: "01-01-2025",
  });
  const invalidResult = createClientDocumentBodySchema.validate({
    documentURL: "https://unsafe.example/document.pdf",
    expiryDate: "2025-01-01",
  });
  const req = {
    params: { id: new mongoose.Types.ObjectId().toString() },
    body: {},
  };
  const validationError = await new Promise((resolve) => {
    validateAddClientDocument(req, {}, resolve);
  });

  assert.equal(validResult.error, undefined);
  assert.ok(invalidResult.error);
  assert.equal(validationError.code, "VALIDATION_FAILED");
  assert.equal(
    validationError.details.some(({ field }) => field === "documents"),
    true
  );
});

test("uploads a Client Document and stores private Cloudinary coordinates", async () => {
  const clientId = new mongoose.Types.ObjectId().toString();
  const originalCloudinaryUrl = process.env.CLOUDINARY_URL;
  const originalClientExists = Client.exists;
  const originalDocumentCreate = ClientDocument.create;
  process.env.CLOUDINARY_URL =
    "cloudinary://document-test-key:document-test-secret@document-test-cloud";
  const cloudinary = configureCloudinary();
  const originalUploadStream = cloudinary.uploader.upload_stream;
  let createdPayload;

  Client.exists = async () => ({ _id: clientId });
  ClientDocument.create = async (payload) => {
    createdPayload = payload;
    return new ClientDocument({ _id: new mongoose.Types.ObjectId(), ...payload });
  };
  cloudinary.uploader.upload_stream = (_options, callback) => ({
    end() {
      callback(null, {
        secure_url: "https://res.cloudinary.com/test/raw/upload/v1/client/file.pdf",
        public_id: "client/file.pdf",
        resource_type: "raw",
      });
    },
  });

  try {
    const document = await addClientDocument(
      clientId,
      { documentType: "Other" },
      { originalname: "file.pdf", buffer: Buffer.from("document") },
      "correlation-id"
    );

    assert.equal(createdPayload.client, clientId);
    assert.equal(createdPayload.documentTitle, "file.pdf");
    assert.equal(createdPayload.cloudinaryPublicId, "client/file.pdf");
    assert.equal(document.toJSON().cloudinaryPublicId, undefined);
  } finally {
    Client.exists = originalClientExists;
    ClientDocument.create = originalDocumentCreate;
    cloudinary.uploader.upload_stream = originalUploadStream;
    if (originalCloudinaryUrl === undefined) {
      delete process.env.CLOUDINARY_URL;
    } else {
      process.env.CLOUDINARY_URL = originalCloudinaryUrl;
    }
  }
});

test("deletes the Cloudinary asset before deleting Client Document metadata", async () => {
  const documentId = new mongoose.Types.ObjectId().toString();
  const originalCloudinaryUrl = process.env.CLOUDINARY_URL;
  const originalFindById = ClientDocument.findById;
  const originalFindByIdAndDelete = ClientDocument.findByIdAndDelete;
  process.env.CLOUDINARY_URL =
    "cloudinary://document-test-key:document-test-secret@document-test-cloud";
  const cloudinary = configureCloudinary();
  const originalDestroy = cloudinary.uploader.destroy;
  const operations = [];
  const document = new ClientDocument({
    _id: documentId,
    client: new mongoose.Types.ObjectId(),
    documentURL: "https://res.cloudinary.com/test/raw/upload/v1/client/file.pdf",
    cloudinaryPublicId: "client/file.pdf",
    cloudinaryResourceType: "raw",
  });

  ClientDocument.findById = () => ({
    select() {
      return this;
    },
    async exec() {
      return document;
    },
  });
  cloudinary.uploader.destroy = async (publicId, options) => {
    operations.push(["cloudinary", publicId, options.resource_type]);
    return { result: "ok" };
  };
  ClientDocument.findByIdAndDelete = () => ({
    async exec() {
      operations.push(["database", documentId]);
      return document;
    },
  });

  try {
    await deleteClientDocument(documentId);

    assert.deepEqual(operations, [
      ["cloudinary", "client/file.pdf", "raw"],
      ["database", documentId],
    ]);
  } finally {
    ClientDocument.findById = originalFindById;
    ClientDocument.findByIdAndDelete = originalFindByIdAndDelete;
    cloudinary.uploader.destroy = originalDestroy;
    if (originalCloudinaryUrl === undefined) {
      delete process.env.CLOUDINARY_URL;
    } else {
      process.env.CLOUDINARY_URL = originalCloudinaryUrl;
    }
  }
});
