import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";
import ClientDriver from "../models/clientDrivers.model.js";
import ClientMember from "../models/clientMembers.model.js";
import ClientVehicle from "../models/clientVehicles.model.js";

const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const RENEWAL_SOURCES = Object.freeze([
  {
    scope: "Clients",
    model: Client,
    fields: [
      "$passport.passportExpiryDate",
      "$emirates.emiratesExpiryDate",
      "$visa.visaExpiryDate",
      "$healthInsurance.healthInsuranceExpiryDate",
    ],
  },
  {
    scope: "Clients",
    model: ClientMember,
    fields: [
      "$passport.passportExpiryDate",
      "$emirates.emiratesExpiryDate",
      "$visa.visaExpiryDate",
      "$healthInsurance.healthInsuranceExpiryDate",
    ],
  },
  {
    scope: "Companies",
    model: ClientCompany,
    fields: ["$licenceExpiryDate"],
  },
  {
    scope: "Renewals",
    model: ClientVehicle,
    fields: ["$registrationExpiry", "$insuranceExpiry"],
  },
  {
    scope: "Renewals",
    model: ClientDriver,
    fields: ["$licenceExpiryDate"],
  },
]);

// Converts a validated dd-mm-yyyy filter into a UTC date for MongoDB comparisons.
// Date-only values use midnight UTC so filter and renewal boundaries remain deterministic.
const parseDashboardDate = (value) => {
  if (!value) {
    return null;
  }

  const [day, month, year] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

// Returns midnight UTC for the injected clock, preventing time-of-day from changing KPI buckets.
// Injecting the clock keeps expired and due-soon calculations deterministic in tests.
const getUtcStartOfDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Builds one aggregation that normalizes stored date strings and counts renewal status buckets.
// Due-soon thresholds are cumulative and the 60-day value is the dashboard's total due-soon KPI.
export const buildRenewalKPIAggregation = ({
  fields,
  fromDate,
  toDate,
  today,
  highPriorityOnly,
}) => {
  const dueIn7Days = new Date(today.getTime() + 7 * DAY_IN_MILLISECONDS);
  const dueIn14Days = new Date(today.getTime() + 14 * DAY_IN_MILLISECONDS);
  const dueIn30Days = new Date(today.getTime() + 30 * DAY_IN_MILLISECONDS);
  const dueIn45Days = new Date(today.getTime() + 45 * DAY_IN_MILLISECONDS);
  const dueIn60Days = new Date(today.getTime() + 60 * DAY_IN_MILLISECONDS);
  const expiryFilter = { $ne: null };

  if (fromDate) {
    expiryFilter.$gte = fromDate;
  }
  if (toDate) {
    expiryFilter.$lte = toDate;
  }
  if (highPriorityOnly) {
    expiryFilter.$lte =
      expiryFilter.$lte && expiryFilter.$lte < dueIn7Days
        ? expiryFilter.$lte
        : dueIn7Days;
  }

  const countBetweenTodayAnd = (endDate) => ({
    $cond: [
      {
        $and: [
          { $gte: ["$expiryDate", today] },
          { $lte: ["$expiryDate", endDate] },
        ],
      },
      1,
      0,
    ],
  });

  return [
    { $project: { renewalDate: fields } },
    { $unwind: "$renewalDate" },
    {
      $set: {
        expiryDate: {
          $dateFromString: {
            dateString: "$renewalDate",
            format: "%d-%m-%Y",
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { expiryDate: expiryFilter } },
    {
      $group: {
        _id: null,
        totalRenewalsTracked: { $sum: 1 },
        totalExpired: {
          $sum: { $cond: [{ $lt: ["$expiryDate", today] }, 1, 0] },
        },
        dueWithin7Days: { $sum: countBetweenTodayAnd(dueIn7Days) },
        dueWithin14Days: { $sum: countBetweenTodayAnd(dueIn14Days) },
        dueWithin30Days: { $sum: countBetweenTodayAnd(dueIn30Days) },
        dueWithin45Days: { $sum: countBetweenTodayAnd(dueIn45Days) },
        dueWithin60Days: { $sum: countBetweenTodayAnd(dueIn60Days) },
        validAndCompliant: {
          $sum: { $cond: [{ $gt: ["$expiryDate", dueIn60Days] }, 1, 0] },
        },
      },
    },
  ];
};

// Creates an aggregation expression that counts populated identifier fields on one record.
// Empty and missing strings contribute zero so partially completed identity records stay accurate.
const countPopulatedFields = (fields) => ({
  $add: fields.map((field) => ({
    $cond: [
      { $gt: [{ $strLenCP: { $ifNull: [`$${field}`, ""] } }, 0] },
      1,
      0,
    ],
  })),
});

// Counts selected populated fields across a collection without loading documents into application memory.
// The helper returns zero for an empty collection to keep the response shape stable.
const countFieldsAcrossCollection = async (Model, fields) => {
  const [result] = await Model.aggregate([
    { $project: { fieldCount: countPopulatedFields(fields) } },
    { $group: { _id: null, count: { $sum: "$fieldCount" } } },
  ]).exec();

  return result?.count ?? 0;
};

// Counts Company records whose owning Client is currently Active.
// Client status supplies the active state because ClientCompany has no status field of its own.
const countActiveCompanies = async () => {
  const [result] = await ClientCompany.aggregate([
    {
      $lookup: {
        from: "clients",
        localField: "client",
        foreignField: "_id",
        as: "owningClient",
      },
    },
    { $match: { "owningClient.status": "Active" } },
    { $count: "count" },
  ]).exec();

  return result?.count ?? 0;
};

// Returns the source collections selected by the dashboard type filter.
// Renewals, High Priority, and an omitted type include every expiry-bearing model.
const selectRenewalSources = (type) => {
  if (type === "Clients" || type === "Companies") {
    return RENEWAL_SOURCES.filter(({ scope }) => scope === type);
  }

  return RENEWAL_SOURCES;
};

// Aggregates renewal health and global inventory counts for the Client dashboard.
// The optional clock is injected for deterministic boundary behavior in service tests.
export const getClientDashboardKPI = async (query, now = new Date()) => {
  const today = getUtcStartOfDay(now);
  const fromDate = parseDashboardDate(query.fromDate);
  const toDate = parseDashboardDate(query.toDate);
  const selectedSources = selectRenewalSources(query.type);

  const renewalRequests = selectedSources.map(({ model, fields }) =>
    model
      .aggregate(
        buildRenewalKPIAggregation({
          fields,
          fromDate,
          toDate,
          today,
          highPriorityOnly: query.type === "High Priority",
        })
      )
      .exec()
  );

  const [
    renewalResults,
    totalClients,
    activeCompanies,
    clientIdentityCount,
    memberIdentityCount,
    vehicleCount,
    driverCount,
    tradeLicense,
  ] = await Promise.all([
    Promise.all(renewalRequests),
    Client.countDocuments({}).exec(),
    countActiveCompanies(),
    countFieldsAcrossCollection(Client, [
      "passport.passportNumber",
      "emirates.emiratesId",
      "visa.visaUIDNumber",
    ]),
    countFieldsAcrossCollection(ClientMember, [
      "passport.passportNumber",
      "emirates.emiratesId",
      "visa.visaUIDNumber",
    ]),
    ClientVehicle.countDocuments({}).exec(),
    ClientDriver.countDocuments({}).exec(),
    countFieldsAcrossCollection(ClientCompany, [
      "tradeLicenceNumber",
      "vatTaxRegistrationNumber",
      "corporateTaxNumber",
    ]),
  ]);

  const renewalTotals = renewalResults.reduce(
    (totals, [result = {}]) => {
      for (const field of Object.keys(totals)) {
        totals[field] += result[field] ?? 0;
      }
      return totals;
    },
    {
      totalRenewalsTracked: 0,
      totalExpired: 0,
      dueWithin7Days: 0,
      dueWithin14Days: 0,
      dueWithin30Days: 0,
      dueWithin45Days: 0,
      dueWithin60Days: 0,
      validAndCompliant: 0,
    }
  );

  return {
    totalRenewalsTracked: renewalTotals.totalRenewalsTracked,
    totalExpired: renewalTotals.totalExpired,
    totalDueSoon: renewalTotals.dueWithin60Days,
    dueSoonBreakdown: {
      within7Days: renewalTotals.dueWithin7Days,
      within14Days: renewalTotals.dueWithin14Days,
      within30Days: renewalTotals.dueWithin30Days,
      within45Days: renewalTotals.dueWithin45Days,
      within60Days: renewalTotals.dueWithin60Days,
    },
    validAndCompliant: renewalTotals.validAndCompliant,
    totalClients,
    activeCompanies,
    vatDue: 0,
    corporateTax: 0,
    visaEidPassport: clientIdentityCount + memberIdentityCount,
    insuranceAndFleet: vehicleCount + driverCount,
    tradeLicense,
  };
};
