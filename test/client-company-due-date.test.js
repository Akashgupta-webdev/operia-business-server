import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import { updateNextVATorTAXDueDate } from "../src/modules/clients/services/clientCompanyUpdate.service.js";
import { validateUpdateNextVATorTAXDueDate } from "../src/modules/clients/validators/clientCompanyBody.validator.js";

test("validates either or both ISO due dates and rejects invalid requests", () => {
  const companyId = new mongoose.Types.ObjectId().toString();
  for (const body of [
    { nextVATDue: "2030-01-01" },
    { nextTAXDue: "2030-02-01T00:00:00.000Z" },
    { nextVATDue: "2030-01-01", nextTAXDue: "2030-02-01" },
  ]) {
    const req = { params: { companyId }, body };
    validateUpdateNextVATorTAXDueDate(req, {}, (error) => assert.equal(error, undefined));
    for (const field of Object.keys(body)) assert.ok(req.validatedBody[field] instanceof Date);
  }
  for (const body of [{}, undefined, { nextVATDue: "invalid" }, { nextTAXDue: null }, { nextVATDue: 123 }, { companyName: "Other" }]) {
    validateUpdateNextVATorTAXDueDate({ params: { companyId }, body }, {}, (error) => {
      assert.equal(error.code, "VALIDATION_FAILED");
      assert.equal(error.status, 422);
    });
  }
  validateUpdateNextVATorTAXDueDate({ params: { companyId: "invalid" }, body: { nextVATDue: "2030-01-01" } }, {}, (error) => {
    assert.equal(error.details[0].field, "companyId");
  });
});

test("updates supplied dates by Company id while preserving other fields", async (t) => {
  const company = new ClientCompany({
    client: new mongoose.Types.ObjectId(),
    companyName: "Example LLC",
    complianceDueDate: { nextVATDue: "2029-01-01", nextTAXDue: "2029-02-01" },
  });
  let saves = 0;
  t.mock.method(company, "save", async () => { saves += 1; return company; });
  t.mock.method(ClientCompany, "findById", (id) => {
    assert.equal(id, company.id);
    return { exec: async () => company };
  });
  await updateNextVATorTAXDueDate(company.id, { nextVATDue: new Date("2030-01-01") });
  assert.equal(company.complianceDueDate.nextVATDue.toISOString(), "2030-01-01T00:00:00.000Z");
  assert.equal(company.complianceDueDate.nextTAXDue.toISOString(), "2029-02-01T00:00:00.000Z");
  await updateNextVATorTAXDueDate(company.id, { nextTAXDue: new Date("2030-02-01") });
  assert.equal(company.complianceDueDate.nextVATDue.toISOString(), "2030-01-01T00:00:00.000Z");
  assert.equal(company.complianceDueDate.nextTAXDue.toISOString(), "2030-02-01T00:00:00.000Z");
  assert.equal(company.companyName, "Example LLC");
  assert.equal(saves, 2);
});

test("returns a Company not found error for a missing Company", async (t) => {
  t.mock.method(ClientCompany, "findById", () => ({ exec: async () => null }));
  await assert.rejects(updateNextVATorTAXDueDate(new mongoose.Types.ObjectId().toString(), { nextVATDue: new Date("2030-01-01") }), {
    code: "CLIENT_COMPANY_NOT_FOUND", status: 404,
  });
});
