import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import ClientVATFiling from "../src/modules/clients/models/clientVATFiling.model.js";
import ClientTAXFiling from "../src/modules/clients/models/clientTAXFiling.model.js";
import Client from "../src/modules/clients/models/client.model.js";
import {
  buildAddedComplianceClientsPipeline,
  buildComplianceMetricsPipeline,
  getAddedComplianceClients,
} from "../src/modules/clients/services/clientComplianceQuery.service.js";

for (const Model of [ClientVATFiling, ClientTAXFiling]) {
  test(`${Model.modelName} validates fields and computes exact payable tax after edits`, async () => {
    const filing = new Model({
      client: new mongoose.Types.ObjectId(), company: new mongoose.Types.ObjectId(),
      input: "0.30", output: "0.20", nextDueDate: "20-10-2026",
    });
    await filing.validate();
    assert.equal(filing.status, "pending");
    assert.equal(filing.payableTax, "0.10");
    assert.equal(filing.toJSON().payableTax, "0.10");
    assert.equal(filing.nextDueDate.toISOString(), "2026-10-20T00:00:00.000Z");
    filing.output = "1.20";
    assert.equal(filing.payableTax, "-0.90");
    filing.input = "9999999999999999.99";
    assert.equal(filing.payableTax, "9999999999999998.79");
    filing.input = "1.001";
    await assert.rejects(filing.validate(), /Input must/);
    filing.input = "1.00";
    filing.status = "completed";
    await assert.rejects(filing.validate(), /not a valid enum/);
    filing.status = "complete";
    filing.nextDueDate = "31-02-2026";
    await assert.rejects(filing.validate(), /Cast to Date failed/);
    const invalid = new Model({});
    await assert.rejects(invalid.validate(), (error) => {
      for (const field of ["client", "company", "input", "output", "nextDueDate"]) assert.ok(error.errors[field]);
      return true;
    });
  });
}

test("added clients join the latest filing once after pagination and preserve newest-company TRN", () => {
  const pipeline = buildAddedComplianceClientsPipeline({ page: 2, limit: 5, search: "Example" });
  const companyLookup = pipeline.find((stage) => stage.$lookup).$lookup;
  assert.equal(companyLookup.pipeline.at(-1).$project.vatTaxRegistrationNumber, 1);
  const data = pipeline.at(-1).$facet.data;
  assert.deepEqual(data[1], { $skip: 5 });
  assert.deepEqual(data[2], { $limit: 5 });
  assert.equal(data[3].$lookup.from, "clientVATFilings");
  assert.deepEqual(data[3].$lookup.pipeline[1], { $sort: { filingDate: -1, _id: -1 } });
  assert.deepEqual(data[3].$lookup.pipeline[2], { $limit: 1 });
  const projection = data.at(-1).$project;
  assert.deepEqual(projection.lastFilingDate.$ifNull[0], { $arrayElemAt: ["$latestVatFiling.filingDate", 0] });
  assert.deepEqual(projection.nextDueDate.$ifNull[0], { $arrayElemAt: ["$latestVatFiling.nextDueDate", 0] });
  assert.equal(projection.vatTaxRegistrationNumber.$let.in.$ifNull[0], "$$company.vatTaxRegistrationNumber");
});

test("metrics include both sources and enforce the confirmed date boundaries in UAE time", () => {
  const pipeline = buildComplianceMetricsPipeline(new Date("2026-10-13T21:00:00Z"));
  assert.deepEqual(pipeline[0], { $match: { complianceService: true } });
  assert.deepEqual(pipeline.slice(1, 3).map((stage) => stage.$lookup.from), ["clientVATFilings", "clientTAXFilings"]);
  for (const stage of pipeline.slice(1, 3)) {
    const lookup = stage.$lookup.pipeline;
    assert.deepEqual(lookup[0].$match.status, { $in: ["pending", "complete"] });
    assert.deepEqual(lookup[1].$group.totalTaxFilings.$sum.$cond[0], { $eq: ["$status", "complete"] });
    const range = lookup[1].$group.actionRequired.$sum.$cond[0].$and;
    assert.equal(range[0].$gt[1].toISOString(), "2026-10-14T00:00:00.000Z");
    assert.equal(range[1].$lte[1].toISOString(), "2026-10-29T00:00:00.000Z");
    for (const [day, expected] of [[13, false], [14, false], [15, true], [29, true], [30, false]]) {
      const due = new Date(Date.UTC(2026, 9, day));
      assert.equal(due > range[0].$gt[1] && due <= range[1].$lte[1], expected);
    }
  }
  assert.equal(pipeline.some((stage) => stage.$skip || stage.$limit), false);
});

test("global metrics survive empty search pages and default to zero without any filings", async (t) => {
  let metrics = [{ totalTaxFilings: 7, actionRequired: 2 }];
  t.mock.method(Client, "aggregate", (pipeline) => ({
    collation() { return this; },
    async exec() {
      return pipeline.at(-1).$facet ? [{ data: [], metadata: [] }] : metrics;
    },
  }));
  const query = { page: 8, limit: 20, search: "No results" };
  const result = await getAddedComplianceClients(query);
  assert.deepEqual(result.clients, []);
  assert.equal(result.page.total, 0);
  assert.deepEqual(result.metrics, { totalTaxFilings: 7, actionRequired: 2 });
  metrics = [];
  assert.deepEqual((await getAddedComplianceClients(query)).metrics, { totalTaxFilings: 0, actionRequired: 0 });
});
