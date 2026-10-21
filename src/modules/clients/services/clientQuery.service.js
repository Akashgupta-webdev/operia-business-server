import Client from "../models/client.model.js";

const SORT_FIELDS = Object.freeze({
  "Newest First": { createdAt: -1, _id: 1 },
  "Oldest First": { createdAt: 1, _id: 1 },
  "Name(A-Z)": { name: 1, _id: 1 },
  "Name(Z-A)": { name: -1, _id: 1 },
});

// Escapes user search text before it is converted to a case-insensitive MongoDB expression.
// This makes punctuation literal and prevents callers from supplying arbitrary regular expressions.
const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Builds one aggregation that filters Clients, joins related collections, counts them, and paginates.
// Optional compliance membership selects a minimal summary; the facet keeps totals consistent.
export const buildGetClientsPipeline = ({
  search,
  page,
  limit,
  status,
  clientType,
  sort,
}, { complianceService, includeVatRegistration = false } = {}) => {
  const pipeline = [];
  const isComplianceList = typeof complianceService === "boolean";
  const includeCompanyVat = includeVatRegistration || !isComplianceList;
  const clientFilter = {
    ...(status ? { status } : {}),
    ...(clientType ? { clientType } : {}),
    ...(isComplianceList
      ? complianceService
        ? { complianceService: true }
        : { $or: [{ complianceService: false }, { complianceService: { $exists: false } }] }
      : {}),
  };

  if (Object.keys(clientFilter).length > 0) {
    pipeline.push({ $match: clientFilter });
  }

  pipeline.push(
    {
      $lookup: {
        from: "clientCompanies",
        let: { clientId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$client", "$$clientId"] } } },
          { $sort: { createdAt: -1, _id: 1 } },
          { $project: { companyName: 1, ...(includeCompanyVat ? { vatTaxRegistrationNumber: 1 } : {}) } },
        ],
        as: "companies",
      },
    },
    ...(!isComplianceList ? [{
      $lookup: {
        from: "clientServices",
        let: { clientId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$client", "$$clientId"] } } },
          { $count: "count" },
        ],
        as: "serviceStats",
      },
    },
    {
      $lookup: {
        from: "clientDocuments",
        let: { clientId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$client", "$$clientId"] } } },
          { $count: "count" },
        ],
        as: "documentStats",
      },
    }] : [])
  );

  if (search) {
    const searchExpression = new RegExp(
      escapeRegularExpression(search),
      "i"
    );
    pipeline.push({
      $match: {
        $or: [
          { name: searchExpression },
          ...(!isComplianceList ? [
            { emailAddress: searchExpression },
            { mobileNumber: searchExpression },
            { whatsappNumber: searchExpression },
          ] : []),
          { "companies.companyName": searchExpression },
        ],
      },
    });
  }

  pipeline.push({
    $facet: {
      data: [
        { $sort: SORT_FIELDS[sort ?? "Newest First"] },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: { $toString: "$_id" },
            name: { $ifNull: ["$name", null] },
            mobileNumber: { $ifNull: ["$mobileNumber", null] },
            nationality: { $ifNull: ["$nationality", null] },
            companyName: {
              $ifNull: [{ $arrayElemAt: ["$companies.companyName", 0] }, null],
            },
            ...(includeCompanyVat ? {
              vatTaxRegistrationNumber: {
                $let: {
                  vars: { company: { $arrayElemAt: ["$companies", 0] } },
                  in: { $ifNull: ["$$company.vatTaxRegistrationNumber", null] },
                },
              },
            } : {}),
            ...(!isComplianceList ? {
              clientId: { $toString: "$_id" },
              companyId: {
                $let: {
                  vars: { company: { $arrayElemAt: ["$companies", 0] } },
                  in: { $toString: { $ifNull: ["$$company._id", null] } },
                },
              },
              clientType: { $ifNull: ["$clientType", null] },
              emailAddress: { $ifNull: ["$emailAddress", null] },
              status: { $ifNull: ["$status", null] },
              companyCount: { $size: "$companies" },
              serviceCount: {
                $ifNull: [{ $arrayElemAt: ["$serviceStats.count", 0] }, 0],
              },
              documentCount: {
                $ifNull: [{ $arrayElemAt: ["$documentStats.count", 0] }, 0],
              },
            } : {}),
          },
        },
      ],
      metadata: [{ $count: "total" }],
    },
  });

  return pipeline;
};

// Executes the list aggregation with case-insensitive name collation and builds page metadata.
// Empty result sets return a stable empty array with zero total and totalPages values.
export const getClients = async (query, options) => {
  const pipeline = buildGetClientsPipeline(query, options);
  return executeClientListPipeline(query, pipeline);
};

// Executes a Client list pipeline and consistently formats pagination metadata.
// Allows specialized Client views to reuse the existing empty-page and count contract.
export const executeClientListPipeline = async (query, pipeline) => {
  const [result = { data: [], metadata: [] }] = await Client.aggregate(pipeline)
    .collation({ locale: "en", strength: 2 })
    .exec();
  const total = result.metadata[0]?.total ?? 0;

  return {
    clients: result.data,
    page: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};
