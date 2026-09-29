import assert from "node:assert/strict";
import test from "node:test";
import ClientRoute from "../src/modules/clients/client.route.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import { buildGetClientDocumentsPipeline, getClientDocuments } from "../src/modules/clients/services/clientDocumentQuery.service.js";
import { getClientDocumentsQuerySchema, validateGetClientDocuments } from "../src/modules/clients/validators/clientDocumentQuery.validator.js";

test("document list route precedes client detail", () => {
  const routes = ClientRoute.stack.filter(layer => layer.route?.methods.get).map(layer => layer.route.path);
  assert.ok(routes.indexOf("/documents") >= 0);
  assert.ok(routes.indexOf("/documents") < routes.indexOf("/:id"));
});

test("document queries default, normalize and reject invalid input", () => {
  assert.deepEqual(getClientDocumentsQuerySchema.validate({}).value, { page: 1, limit: 25 });
  assert.deepEqual(getClientDocumentsQuerySchema.validate({ page: "2", search: "  Alice  " }).value, { page: 2, limit: 25, search: "Alice" });
  for (const query of [{ page: 0 }, { page: 1.5 }, { limit: 101 }, { limit: -1 }, { search: " " }, { search: "x".repeat(101) }, { unknown: true }]) {
    let failure;
    validateGetClientDocuments({ query }, {}, error => { failure = error; });
    assert.equal(failure.code, "VALIDATION_FAILED");
  }
});

test("search matches literal titles or joined client names before pagination", () => {
  const pipeline = buildGetClientDocumentsPipeline({ page: 3, limit: 5, search: "A.*" });
  assert.equal(pipeline[0].$lookup.from, "clients");
  const conditions = pipeline[2].$match.$or;
  for (const expression of [conditions[0].documentTitle, conditions[1]["clientInformation.name"]]) {
    assert.ok(expression.test("prefix a.* suffix"));
    assert.equal(expression.test("Alice"), false);
  }
  const facet = pipeline.at(-1).$facet;
  assert.deepEqual(facet.data.slice(0, 3), [{ $sort: { createdAt: -1, _id: 1 } }, { $skip: 10 }, { $limit: 5 }]);
  assert.equal(facet.data[3].$project.cloudinaryPublicId, undefined);
  assert.equal(facet.data[3].$project.clientInformation, undefined);
  assert.deepEqual(facet.metadata, [{ $count: "total" }]);
});

test("document page totals handle populated and empty results", async (t) => {
  const rows = [{ id: "document-id", documentTitle: "Passport" }];
  const aggregate = t.mock.method(ClientDocument, "aggregate", () => ({ exec: async () => [{ data: rows, metadata: [{ total: 26 }] }] }));
  assert.deepEqual(await getClientDocuments({ page: 2, limit: 25 }), {
    kpi: { totalDocuments: 0, expiringIn30Days: 0, expired: 0, validDocuments: 0 }, documents: rows, page: { page: 2, limit: 25, total: 26, totalPages: 2 },
  });
  aggregate.mock.mockImplementation(() => ({ exec: async () => [{ data: [], metadata: [] }] }));
  assert.deepEqual(await getClientDocuments({ page: 1, limit: 25 }), {
    kpi: { totalDocuments: 0, expiringIn30Days: 0, expired: 0, validDocuments: 0 }, documents: [], page: { page: 1, limit: 25, total: 0, totalPages: 0 },
  });
});


test("global document KPIs remain independent of filtered page totals", async (t) => {
  const { getClientDocuments: controller } = await import("../src/modules/clients/controller/clientDocument.controller.js");
  const kpi = { totalDocuments: 10, expiringIn30Days: 2, expired: 1, validDocuments: 4 };
  t.mock.method(ClientDocument, "aggregate", pipeline => ({ exec: async () => {
    if (pipeline[0].$facet?.inventory) {
      return [{ inventory: [{ total: 10 }], renewals: [{ totalRenewalsTracked: 7, totalExpired: 1, dueWithin30Days: 2 }] }];
    }
    return [{ data: [], metadata: [] }];
  } }));
  let body;
  await controller({ validatedQuery: { page: 50, limit: 1, search: "absent" }, correlationId: "test" }, {
    status(code) { assert.equal(code, 200); return this; },
    json(value) { body = value; return this; },
  }, error => { throw error; });
  assert.deepEqual(body.kpi, kpi);
  assert.equal(body.page.total, 0);
  assert.deepEqual(body.data, []);
  assert.equal("systemStatus" in body.kpi, false);
});

test("document KPI expiry boundaries use midnight UTC and inclusive day 30", async (t) => {
  const { getClientDocumentKPI } = await import("../src/modules/clients/services/clientDocumentQuery.service.js");
  let pipeline;
  t.mock.method(ClientDocument, "aggregate", value => {
    pipeline = value;
    return { exec: async () => [] };
  });
  assert.deepEqual(await getClientDocumentKPI(new Date("2026-09-30T23:59:59Z")), {
    totalDocuments: 0, expiringIn30Days: 0, expired: 0, validDocuments: 0,
  });
  const renewals = pipeline[0].$facet.renewals;
  assert.deepEqual(renewals[0], { $project: { renewalDate: ["$expiryDate"] } });
  assert.deepEqual(renewals[3], { $match: { expiryDate: { $ne: null } } });
  const group = renewals[4].$group;
  assert.deepEqual(group.totalExpired.$sum.$cond[0], { $lt: ["$expiryDate", new Date("2026-09-30T00:00:00Z")] });
  assert.deepEqual(group.dueWithin30Days.$sum.$cond[0], { $and: [
    { $gte: ["$expiryDate", new Date("2026-09-30T00:00:00Z")] },
    { $lte: ["$expiryDate", new Date("2026-10-30T00:00:00Z")] },
  ] });
});
