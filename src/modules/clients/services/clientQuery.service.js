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
// A facet returns the selected page and total from the exact same filtered result set.
export const buildGetClientsPipeline = ({
  search,
  page,
  limit,
  status,
  clientType,
  sort,
}) => {
  const pipeline = [];
  const clientFilter = {
    ...(status ? { status } : {}),
    ...(clientType ? { clientType } : {}),
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
          { $project: { companyName: 1 } },
        ],
        as: "companies",
      },
    },
    {
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
    }
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
          { emailAddress: searchExpression },
          { mobileNumber: searchExpression },
          { whatsappNumber: searchExpression },
          { "companies.companyName": searchExpression },
        ],
      },
    });
  }

  pipeline.push({
    $facet: {
      data: [
        { $sort: SORT_FIELDS[sort] },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: { $toString: "$_id" },
            name: { $ifNull: ["$name", null] },
            clientType: { $ifNull: ["$clientType", null] },
            mobileNumber: { $ifNull: ["$mobileNumber", null] },
            emailAddress: { $ifNull: ["$emailAddress", null] },
            nationality: { $ifNull: ["$nationality", null] },
            status: { $ifNull: ["$status", null] },
            companyName: {
              $ifNull: [{ $arrayElemAt: ["$companies.companyName", 0] }, null],
            },
            companyCount: { $size: "$companies" },
            serviceCount: {
              $ifNull: [{ $arrayElemAt: ["$serviceStats.count", 0] }, 0],
            },
            documentCount: {
              $ifNull: [{ $arrayElemAt: ["$documentStats.count", 0] }, 0],
            },
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
export const getClients = async (query) => {
  const pipeline = buildGetClientsPipeline(query);
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
