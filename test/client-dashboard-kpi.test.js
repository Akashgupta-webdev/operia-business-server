import assert from "node:assert/strict";
import test from "node:test";

import ClientRoute from "../src/modules/clients/client.route.js";
import Client from "../src/modules/clients/models/client.model.js";
import ClientCompany from "../src/modules/clients/models/clientCompany.model.js";
import ClientDriver from "../src/modules/clients/models/clientDrivers.model.js";
import ClientMember from "../src/modules/clients/models/clientMembers.model.js";
import ClientVehicle from "../src/modules/clients/models/clientVehicles.model.js";
import {
  buildRenewalKPIAggregation,
  getClientDashboardKPI,
} from "../src/modules/clients/services/clientDashboard.service.js";
import { getClientDashboardKPIQuerySchema } from "../src/modules/clients/validators/clientDashboard.validator.js";

test("registers GET /dashboard/kpi before the Client id route", () => {
  const routes = ClientRoute.stack
    .filter((layer) => layer.route)
    .map((layer) => ({ path: layer.route.path, methods: layer.route.methods }));
  const dashboardIndex = routes.findIndex(
    ({ path, methods }) => path === "/dashboard/kpi" && methods.get
  );
  const clientDetailIndex = routes.findIndex(
    ({ path, methods }) => path === "/:id" && methods.get
  );

  assert.ok(dashboardIndex >= 0);
  assert.ok(dashboardIndex < clientDetailIndex);
});

test("validates dashboard types, dates, defaults, and date order", () => {
  const valid = getClientDashboardKPIQuerySchema.validate({
    type: "High Priority",
    fromDate: "01-08-2026",
    toDate: "30-08-2026",
  });
  const defaults = getClientDashboardKPIQuerySchema.validate({});
  const invalidType = getClientDashboardKPIQuerySchema.validate({
    type: "Unknown",
  });
  const invalidRange = getClientDashboardKPIQuerySchema.validate({
    fromDate: "31-08-2026",
    toDate: "01-08-2026",
  });
  const invalidCalendarDate = getClientDashboardKPIQuerySchema.validate({
    fromDate: "31-02-2026",
  });
  const unknownField = getClientDashboardKPIQuerySchema.validate({ days: 7 });

  assert.equal(valid.error, undefined);
  assert.deepEqual(defaults.value, { fromDate: null, toDate: null });
  assert.ok(invalidType.error);
  assert.ok(invalidRange.error);
  assert.ok(invalidCalendarDate.error);
  assert.ok(unknownField.error);
});

test("builds cumulative due-soon and inclusive date filters", () => {
  const today = new Date("2026-08-30T00:00:00.000Z");
  const fromDate = new Date("2026-08-01T00:00:00.000Z");
  const toDate = new Date("2026-09-03T00:00:00.000Z");
  const pipeline = buildRenewalKPIAggregation({
    fields: ["$licenceExpiryDate"],
    fromDate,
    toDate,
    today,
    highPriorityOnly: true,
  });
  const expiryFilter = pipeline.find((stage) => stage.$match).$match.expiryDate;
  const group = pipeline.find((stage) => stage.$group).$group;

  assert.equal(expiryFilter.$gte, fromDate);
  assert.equal(expiryFilter.$lte.toISOString(), "2026-09-03T00:00:00.000Z");
  assert.ok(group.dueWithin7Days);
  assert.ok(group.dueWithin60Days);
  assert.ok(group.validAndCompliant);
});

test("combines renewal and inventory aggregates into dashboard KPIs", async () => {
  const models = [Client, ClientMember, ClientCompany, ClientVehicle, ClientDriver];
  const originalAggregates = new Map(models.map((Model) => [Model, Model.aggregate]));
  const originalClientCountDocuments = Client.countDocuments;
  const originalVehicleCountDocuments = ClientVehicle.countDocuments;
  const originalDriverCountDocuments = ClientDriver.countDocuments;
  const renewalByModel = new Map([
    [Client, { totalRenewalsTracked: 4, totalExpired: 1, dueWithin7Days: 1, dueWithin14Days: 1, dueWithin30Days: 2, dueWithin45Days: 2, dueWithin60Days: 2, validAndCompliant: 1 }],
    [ClientMember, { totalRenewalsTracked: 3, totalExpired: 1, dueWithin7Days: 0, dueWithin14Days: 1, dueWithin30Days: 1, dueWithin45Days: 1, dueWithin60Days: 1, validAndCompliant: 1 }],
    [ClientCompany, { totalRenewalsTracked: 1, totalExpired: 0, dueWithin7Days: 1, dueWithin14Days: 1, dueWithin30Days: 1, dueWithin45Days: 1, dueWithin60Days: 1, validAndCompliant: 0 }],
    [ClientVehicle, { totalRenewalsTracked: 2, totalExpired: 1, dueWithin7Days: 0, dueWithin14Days: 0, dueWithin30Days: 0, dueWithin45Days: 1, dueWithin60Days: 1, validAndCompliant: 0 }],
    [ClientDriver, { totalRenewalsTracked: 1, totalExpired: 0, dueWithin7Days: 0, dueWithin14Days: 0, dueWithin30Days: 0, dueWithin45Days: 0, dueWithin60Days: 0, validAndCompliant: 1 }],
  ]);
  const identityCounts = new Map([
    [Client, 3],
    [ClientMember, 4],
    [ClientCompany, 3],
  ]);

  for (const Model of models) {
    Model.aggregate = (pipeline) => ({
      async exec() {
        if (pipeline[0].$lookup) {
          return [{ count: 2 }];
        }
        if (pipeline[0].$project?.fieldCount) {
          return [{ count: identityCounts.get(Model) ?? 0 }];
        }
        return [renewalByModel.get(Model)];
      },
    });
  }
  Client.countDocuments = () => ({ async exec() { return 10; } });
  ClientVehicle.countDocuments = () => ({ async exec() { return 6; } });
  ClientDriver.countDocuments = () => ({ async exec() { return 5; } });

  try {
    const result = await getClientDashboardKPI(
      { fromDate: null, toDate: null },
      new Date("2026-08-30T12:00:00.000Z")
    );

    assert.deepEqual(result, {
      totalRenewalsTracked: 11,
      totalExpired: 3,
      totalDueSoon: 5,
      dueSoonBreakdown: {
        within7Days: 2,
        within14Days: 3,
        within30Days: 4,
        within45Days: 5,
        within60Days: 5,
      },
      validAndCompliant: 3,
      totalClients: 10,
      activeCompanies: 2,
      vatDue: 0,
      corporateTax: 0,
      visaEidPassport: 7,
      insuranceAndFleet: 11,
      tradeLicense: 3,
    });
  } finally {
    for (const [Model, aggregate] of originalAggregates) {
      Model.aggregate = aggregate;
    }
    Client.countDocuments = originalClientCountDocuments;
    ClientVehicle.countDocuments = originalVehicleCountDocuments;
    ClientDriver.countDocuments = originalDriverCountDocuments;
  }
});
