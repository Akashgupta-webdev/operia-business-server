import { formatClientRenewalRow } from "../utils/clientRenewal.utils.js";
import Client from "../models/client.model.js";
import ClientMember from "../models/clientMembers.model.js";
import ClientCompany from "../models/clientCompany.model.js";
import ClientDocument from "../models/clientDocuments.model.js";
import ClientDriver from "../models/clientDrivers.model.js";
import ClientVehicle from "../models/clientVehicles.model.js";

const identityFields = [
  ["passport", "passport.passportNumber", "passport.passportExpiryDate"],
  ["emirates", "emirates.emiratesId", "emirates.emiratesExpiryDate"],
  ["visa", "visa.visaUIDNumber", "visa.visaExpiryDate"],
  ["healthInsurance", "healthInsurance.healthInsuranceCardNumber", "healthInsurance.healthInsuranceExpiryDate"],
];
const renewalSources = [
  { model: Client, source: "client", entity: "name", fields: identityFields },
  { model: ClientMember, source: "member", entity: "name", fields: identityFields },
  { model: ClientCompany, source: "company", entity: "companyName", fields: [
    ["establishment", "establishment.establishmentCard", "establishment.establishmentCardExpiry"],
    ["tradeLicence", "tradeLicence.tradeLicenceNo", "tradeLicence.tradeLicenceExpiry"],
  ] },
  { model: ClientDocument, source: "document", fields: [
    ["document", "documentTitle", "expiryDate"],
  ] },
  { model: ClientDriver, source: "driver", entity: "name", fields: [
    ["driverLicence", "name", "licenceExpiryDate"],
  ] },
  { model: ClientVehicle, source: "vehicle", entity: "registrationNumer", fields: [
    ["vehicleRegistration", "registrationNumer", "registrationExpiry"],
    ["vehicleInsurance", "policyNumber", "insuranceExpiry"],
  ] },
];

// Normalizes each source into one row per expiry without exposing unrelated record fields.
// Date round-tripping excludes invalid calendar dates as well as missing or malformed values.
const buildRenewalSourcePipeline = ({ source, entity, fields }) => [
  { $project: {
    recordId: { $toString: "$_id" },
    client: source === "client" ? "$_id" : "$client",
    source: { $literal: source },
    entity: entity ? { $ifNull: ["$" + entity, null] } : { $literal: null },
    renewals: fields.map(([category, item, expiry]) => ({
      category: { $literal: category },
      item: { $ifNull: ["$" + item, { $toString: "$_id" }] },
      expiryDate: { $ifNull: ["$" + expiry, null] },
    })),
  } },
  { $unwind: "$renewals" },
  { $set: { expirySortDate: { $dateFromString: {
    dateString: { $convert: { input: "$renewals.expiryDate", to: "string", onError: null, onNull: null } },
    format: "%d-%m-%Y", onError: null, onNull: null,
  } } } },
  { $match: { expirySortDate: { $ne: null }, $expr: { $eq: [
    "$renewals.expiryDate",
    { $dateToString: { date: "$expirySortDate", format: "%d-%m-%Y", timezone: "UTC", onNull: null } },
  ] } } },
];

// Combines all six collections before chronological sorting and page slicing.
// Stable source, record and category tie-breakers keep rows with equal expiry dates deterministic.
export const buildClientRenewalsPipeline = ({ page, limit }) => [
  ...buildRenewalSourcePipeline(renewalSources[0]),
  ...renewalSources.slice(1).map((source) => ({ $unionWith: {
    coll: source.model.collection.name,
    pipeline: buildRenewalSourcePipeline(source),
  } })),
  { $facet: {
    data: [
      { $sort: { expirySortDate: 1, source: 1, recordId: 1, "renewals.category": 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $lookup: { from: Client.collection.name, localField: "client", foreignField: "_id", as: "owningClient" } },
      { $set: { clientName: { $ifNull: [{ $arrayElemAt: ["$owningClient.name", 0] }, null] } } },
      { $lookup: {
        from: ClientCompany.collection.name,
        let: { clientId: "$client", recordId: "$recordId", source: "$source" },
        pipeline: [
          { $match: { $expr: { $and: [
            { $eq: ["$client", "$clientId"] },
            { $or: [
              { $ne: ["$source", "company"] },
              { $eq: [{ $toString: "$_id" }, "$recordId"] },
            ] },
          ] } } },
          { $sort: { companyName: 1, _id: 1 } },
          { $project: { _id: 0, companyName: 1 } },
        ],
        as: "companies",
      } },
      { $project: {
        _id: 0,
        companyNames: "$companies.companyName",
        id: { $concat: ["$source", ":", "$recordId", ":", "$renewals.category"] },
        source: 1, recordId: 1,
        clientId: { $convert: { input: "$client", to: "string", onError: null, onNull: null } },
        item: "$renewals.item",
        category: "$renewals.category",
        entity: { $ifNull: ["$entity", "$clientName"] },
        clientName: 1,
        expiryDate: "$renewals.expiryDate",
      } },
    ],
    metadata: [{ $count: "total" }],
  } },
];

// Executes the renewal listing in MongoDB so only the requested page enters application memory.
// Count and rows share the same combined source stream and empty lists retain stable pagination.
export const getClientRenewals = async (query) => {
  const [result = { data: [], metadata: [] }] = await Client.aggregate(
    buildClientRenewalsPipeline(query)
  ).exec();
  const total = result.metadata[0]?.total ?? 0;
  return {
    renewals: result.data.map(formatClientRenewalRow),
    page: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
};
