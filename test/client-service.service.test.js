import assert from "node:assert/strict";
import test from "node:test";

import mongoose from "mongoose";

import Client from "../src/modules/clients/models/client.model.js";
import {
  createClientWithService,
  getClientService,
} from "../src/modules/clients/services/client-service.service.js";
import Document from "../src/modules/common/models/document.model.js";
import Payment from "../src/modules/common/models/payment.model.js";
import Reminder from "../src/modules/common/models/reminder.model.js";
import Service from "../src/modules/common/models/service.model.js";
import Company from "../src/modules/company/models/company.model.js";

test("creates an individual Client Service package in one transaction", async () => {
  const originals = {
    startSession: mongoose.startSession,
    clientCreate: Client.create,
    companyCreate: Company.create,
    serviceCreate: Service.create,
    documentCreate: Document.create,
    paymentCreate: Payment.create,
    reminderCreate: Reminder.create,
  };
  const session = {
    transactionCalls: 0,
    ended: false,
    async withTransaction(work) {
      this.transactionCalls += 1;
      await work();
    },
    async endSession() {
      this.ended = true;
    },
  };
  const clientId = new mongoose.Types.ObjectId();
  const serviceId = new mongoose.Types.ObjectId();
  let companyCreateCalled = false;
  let servicePayload;
  let documentPayloads;

  mongoose.startSession = async () => session;
  Client.create = async () => [{ _id: clientId, clientId: "client-1" }];
  Company.create = async () => {
    companyCreateCalled = true;
    return [];
  };
  Service.create = async ([payload]) => {
    servicePayload = payload;
    return [{ _id: serviceId }];
  };
  Document.create = async (payloads) => {
    documentPayloads = payloads;
    return payloads;
  };
  Payment.create = async () => {
    throw new Error("Payment should not be created.");
  };
  Reminder.create = async () => {
    throw new Error("Reminder should not be created.");
  };

  try {
    const result = await createClientWithService(
      {
        client: { clientType: "INDIVIDUAL" },
        service: {
          category: "VAT_REGISTRATION",
          status: "NOT_STARTED",
          detail: { type: "New" },
        },
      },
      [{ documentUrl: "https://example.test/document.pdf" }]
    );

    assert.equal(session.transactionCalls, 1);
    assert.equal(session.ended, true);
    assert.equal(companyCreateCalled, false);
    assert.equal(result.company, null);
    assert.equal(result.payment, null);
    assert.equal(result.reminder, null);
    assert.equal(servicePayload.client, clientId);
    assert.equal(servicePayload.company, undefined);
    assert.equal(documentPayloads[0].service, serviceId);
    assert.equal(documentPayloads[0].company, undefined);
  } finally {
    mongoose.startSession = originals.startSession;
    Client.create = originals.clientCreate;
    Company.create = originals.companyCreate;
    Service.create = originals.serviceCreate;
    Document.create = originals.documentCreate;
    Payment.create = originals.paymentCreate;
    Reminder.create = originals.reminderCreate;
  }
});

test("gets a complete Client Service package scoped to its Client", async () => {
  const originals = {
    clientFindOne: Client.findOne,
    companyFindOne: Company.findOne,
    serviceFindOne: Service.findOne,
    documentFind: Document.find,
    paymentFindOne: Payment.findOne,
    reminderFindOne: Reminder.findOne,
  };
  const clientMongoId = new mongoose.Types.ObjectId();
  const serviceMongoId = new mongoose.Types.ObjectId();
  const documentMongoId = new mongoose.Types.ObjectId();
  let serviceFilter;

  const leanQuery = (value) => ({
    lean() {
      return this;
    },
    async exec() {
      return value;
    },
  });
  const sortedLeanQuery = (value) => ({
    sort() {
      return this;
    },
    ...leanQuery(value),
  });

  Client.findOne = () =>
    leanQuery({
      _id: clientMongoId,
      clientId: "client-1",
      clientType: "INDIVIDUAL",
    });
  Service.findOne = (filter) => {
    serviceFilter = filter;
    return leanQuery({
      _id: serviceMongoId,
      client: clientMongoId,
      category: "VAT_REGISTRATION",
      status: "NOT_STARTED",
    });
  };
  Company.findOne = () => {
    throw new Error("Company should not be queried for an individual Service.");
  };
  Document.find = () =>
    sortedLeanQuery([
      {
        _id: documentMongoId,
        service: serviceMongoId,
        documentUrl: "https://example.test/document.pdf",
      },
    ]);
  Payment.findOne = () => sortedLeanQuery(null);
  Reminder.findOne = () => sortedLeanQuery(null);

  try {
    const result = await getClientService(
      "client-1",
      serviceMongoId.toString()
    );

    assert.deepEqual(serviceFilter, {
      _id: serviceMongoId.toString(),
      client: clientMongoId,
    });
    assert.equal(result.client.id, clientMongoId.toString());
    assert.equal(result.company, null);
    assert.equal(result.service.id, serviceMongoId.toString());
    assert.equal(result.documents[0].id, documentMongoId.toString());
    assert.equal(result.payment, null);
    assert.equal(result.reminder, null);
  } finally {
    Client.findOne = originals.clientFindOne;
    Company.findOne = originals.companyFindOne;
    Service.findOne = originals.serviceFindOne;
    Document.find = originals.documentFind;
    Payment.findOne = originals.paymentFindOne;
    Reminder.findOne = originals.reminderFindOne;
  }
});
