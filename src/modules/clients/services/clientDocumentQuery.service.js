import ClientDocument from "../models/clientDocuments.model.js";
import { buildRenewalKPIAggregation } from "./clientDashboard.service.js";

// Counts all documents and reuses the dashboard's UTC expiry classification.
// Search and pagination do not affect these global document inventory cards.
export const getClientDocumentKPI = async (now = new Date()) => {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [result] = await ClientDocument.aggregate([
    { $facet: {
      inventory: [{ $count: "total" }],
      renewals: buildRenewalKPIAggregation({ fields: ["$expiryDate"], today }),
    } },
  ]).exec();
  const renewals = result?.renewals?.[0];
  const expired = renewals?.totalExpired ?? 0;
  const expiringIn30Days = renewals?.dueWithin30Days ?? 0;
  return {
    totalDocuments: result?.inventory?.[0]?.total ?? 0,
    expiringIn30Days,
    expired,
    validDocuments: (renewals?.totalRenewalsTracked ?? 0) - expired - expiringIn30Days,
  };
};

// Joins owning Clients before matching document titles or Client names.
// A shared filtered facet keeps totals and newest-first page rows consistent.
export const buildGetClientDocumentsPipeline = ({ page, limit, search }) => {
  const pipeline = [
    { $lookup: { from: "clients", localField: "client", foreignField: "_id", as: "clientInformation" } },
    { $unwind: { path: "$clientInformation", preserveNullAndEmptyArrays: true } },
  ];

  if (search) {
    const expression = new RegExp(RegExp.escape(search), "i");
    pipeline.push({ $match: { $or: [
      { documentTitle: expression },
      { "clientInformation.name": expression },
    ] } });
  }

  pipeline.push({ $facet: {
    data: [
      { $sort: { createdAt: -1, _id: 1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $project: {
        _id: 0,
        id: { $toString: "$_id" },
        client: { $toString: "$client" },
        clientName: { $ifNull: ["$clientInformation.name", null] },
        service: { $toString: "$service" },
        purpose: { $ifNull: ["$purpose", null] },
        documentTitle: { $ifNull: ["$documentTitle", null] },
        documentURL: { $ifNull: ["$documentURL", null] },
        documentType: { $ifNull: ["$documentType", null] },
        issueDate: { $ifNull: ["$issueDate", null] },
        expiryDate: { $ifNull: ["$expiryDate", null] },
        version: { $ifNull: ["$version", 0] },
        createdAt: 1,
        updatedAt: 1,
      } },
    ],
    metadata: [{ $count: "total" }],
  } });
  return pipeline;
};

// Reads the requested document page without exposing internal storage identifiers.
// Empty matches return an empty list and zero totals in the usual Client list contract.
export const getClientDocuments = async (query, now = new Date()) => {
  const [[result = { data: [], metadata: [] }], kpi] = await Promise.all([
    ClientDocument.aggregate(buildGetClientDocumentsPipeline(query)).exec(),
    getClientDocumentKPI(now),
  ]);
  const total = result.metadata[0]?.total ?? 0;
  return {
    documents: result.data,
    kpi,
    page: { page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) },
  };
};
