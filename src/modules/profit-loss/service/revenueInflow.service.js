import ClientService from "../../clients/models/clientService.model.js";

// Builds the Client join, deterministic ordering, pagination, and public response fields.
// A facet calculates rows and total count from the same Client Service result set.
export const buildRevenueInflowPipeline = ({ page, limit }) => [
  {
    $lookup: {
      from: "clients",
      localField: "client",
      foreignField: "_id",
      as: "clientInformation",
    },
  },
  {
    $unwind: {
      path: "$clientInformation",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $facet: {
      data: [
        { $sort: { createdAt: -1, _id: 1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        {
          $project: {
            _id: 0,
            clientName: { $ifNull: ["$clientInformation.name", null] },
            servicePackage: { $ifNull: ["$package", null] },
            serviceCategory: { $ifNull: ["$category", null] },
            packagePrice: {
              $convert: {
                input: "$packagePrice",
                to: "string",
                onError: null,
                onNull: null,
              },
            },
            paymentStatus: { $ifNull: ["$paymentStatus", null] },
            serviceStatus: { $ifNull: ["$status", null] },
          },
        },
      ],
      metadata: [{ $count: "total" }],
    },
  },
];

// Returns one deterministic page of Client Services with their owning Client names.
// Empty collections retain stable list and page metadata shapes for API consumers.
export const getRevenueInflow = async (query) => {
  const [result = { data: [], metadata: [] }] = await ClientService.aggregate(
    buildRevenueInflowPipeline(query)
  ).exec();
  const total = result.metadata[0]?.total ?? 0;

  return {
    revenueInflows: result.data,
    page: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};
