import assert from "node:assert/strict";
import test from "node:test";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import ClientVATFiling from "../src/modules/clients/models/clientVATFiling.model.js";
import ClientTAXFiling from "../src/modules/clients/models/clientTAXFiling.model.js";
import { getClientInformationForCompliance } from "../src/modules/clients/services/clientComplianceInformation.service.js";

test("compliance detail scopes filing totals, handles missing data and UAE deadline boundaries", async (t) => {
  const id = "68ad00000000000000000001";
  let client = { _id: id, name: "Example", status: "Active" };
  let company;
  t.mock.method(Client, "findById", (value) => {
    assert.equal(value, id);
    return { select() { return this; }, lean() { return this; }, async exec() { return client; } };
  });
  t.mock.method(ClientCompany, "findOne", (filter) => {
    assert.deepEqual(filter, { client: id });
    return { sort(value) { assert.deepEqual(value, { createdAt: -1, _id: 1 }); return this; },
      select() { return this; }, lean() { return this; }, async exec() { return company; } };
  });
  for (const [model, count] of [[ClientVATFiling, 3], [ClientTAXFiling, 2]]) {
    t.mock.method(model, "countDocuments", (filter) => {
      assert.deepEqual(filter, { client: id, status: "Paid" });
      return { async exec() { return count; } };
    });
  }
  const now = new Date("2026-10-14T21:00:00Z");
  for (const [dates, dueSoon, overdue] of [
    [["2026-10-15", "2026-11-14"], 2, 0],
    [["2026-10-14", "2026-11-15"], 0, 1],
    [["2026-10-13", "2026-10-14"], 0, 2],
  ]) {
    company = { complianceDueDate: { nextVATDue: new Date(dates[0]), nextTAXDue: new Date(dates[1]) } };
    const result = await getClientInformationForCompliance(id, now);
    assert.deepEqual(result.metrics, { totalFiling: 5, dueSoon, overdue });
    assert.equal(result.information.nextVATDue, company.complianceDueDate.nextVATDue);
  }
  company = null;
  const result = await getClientInformationForCompliance(id, now);
  assert.deepEqual(result.metrics, { totalFiling: 5, dueSoon: 0, overdue: 0 });
  assert.equal(result.information.nextVATDue, null);
  assert.equal(result.information.companyName, null);
  assert.equal(result.information.emailAddress, null);
  client = null;
  await assert.rejects(getClientInformationForCompliance(id, now), { code: "CLIENT_NOT_FOUND" });
});

test("both filing models accept only the new statuses and company deadlines are Dates", async () => {
  for (const Model of [ClientVATFiling, ClientTAXFiling]) {
    const filing = new Model({ client: "68ad00000000000000000001", company: "68ad00000000000000000002",
      input: "1", output: "0", nextDueDate: new Date() });
    assert.equal(filing.status, "Pending");
    for (const status of ["Draft", "Pending", "Submitted", "Paid", "Overdue", "Rejected"]) {
      filing.status = status;
      await filing.validate();
    }
    for (const status of ["complete", "cancelled", "paic", "unknown"]) {
      filing.status = status;
      await assert.rejects(filing.validate(), /not a valid enum/);
    }
  }
  const company = new ClientCompany({ client: "68ad00000000000000000001", companyName: "Example",
    complianceDueDate: { nextVATDue: "2026-10-15", nextTAXDue: "2026-11-15" } });
  await company.validate();
  assert.ok(company.complianceDueDate.nextVATDue instanceof Date);
  assert.ok(company.complianceDueDate.nextTAXDue instanceof Date);
});
