import assert from "node:assert/strict";
import test from "node:test";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import Client from "../src/modules/clients/models/client.model.js";
import { updateClientCompanyInformationSchema } from "../src/modules/clients/validators/clientCompanyBody.validator.js";
import { updateClientCompanyInformation } from "../src/modules/clients/services/clientCompanyUpdate.service.js";
import { formatClientRenewalRow } from "../src/modules/clients/utils/clientRenewal.utils.js";

const client = "68ad00000000000000000001";
for (const [field, numberField, label] of [
  ["civilDefenceCertificate", "certificationNo", "Civil Defence Certificate"],
  ["commercialTradeLicence", "licenceNo", "Commercial Trade Licence"],
]) {
  test(`${field} validates references and real dates consistently in API and model`, async () => {
    for (const number of ["001234", "LCA0000237232-2026", "CN-1234567", "ABC/123.4", null]) {
      const body = { [field]: { [numberField]: number, expiryDate: "29-02-2028" } };
      assert.equal(updateClientCompanyInformationSchema.validate(body).error, undefined);
      await new ClientCompany({ client, companyName: "Example", ...body }).validate();
    }
    for (const value of [{ [numberField]: "ABC" }, { [numberField]: "<123>" }, { [numberField]: "" },
      { [numberField]: "1".repeat(101) }, { expiryDate: "31-02-2027" }, { expiryDate: "29-02-2027" }, { expiryDate: "2027-12-31" }]) {
      const body = { [field]: value };
      assert.ok(updateClientCompanyInformationSchema.validate(body).error);
      await assert.rejects(new ClientCompany({ client, companyName: "Example", ...body }).validate());
    }
    assert.ok(updateClientCompanyInformationSchema.validate({ [field]: { unknown: "x" } }).error);
    assert.ok(updateClientCompanyInformationSchema.validate({ [field]: {} }).error);
    assert.equal(updateClientCompanyInformationSchema.validate({ [field]: null }).error, undefined);
  });

  test(`${field} partial update preserves siblings and supports null clearing`, async (t) => {
    const company = new ClientCompany({ client, companyName: "Example", [field]: { [numberField]: "001234", expiryDate: "31-12-2027" } });
    t.mock.method(Client, "exists", async () => ({ _id: client }));
    t.mock.method(ClientCompany, "findOne", () => ({ exec: async () => company }));
    t.mock.method(company, "save", async () => { await company.validate(); return company; });
    await updateClientCompanyInformation(client, { [field]: { expiryDate: "31-12-2028" } });
    assert.equal(company[field][numberField], "001234");
    assert.equal(company[field].expiryDate, "31-12-2028");
    await updateClientCompanyInformation(client, { [field]: { [numberField]: null } });
    assert.equal(company[field][numberField], null);
    assert.equal(company[field].expiryDate, "31-12-2028");
    await updateClientCompanyInformation(client, { [field]: null });
    assert.equal(company.get(field), null);
  });

  test(`${field} has a readable renewal label`, () => {
    const row = formatClientRenewalRow({ category: field, entity: "Example LLC", companyNames: ["Example LLC"] });
    assert.equal(row.item, `${label} (Example LLC)`);
    assert.equal(row.category, field);
  });
}
