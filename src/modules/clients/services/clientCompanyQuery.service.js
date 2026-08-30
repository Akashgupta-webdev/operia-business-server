import ClientCompany from "../models/clientCompany.model.js";

// Escapes Company search text before creating a case-insensitive MongoDB expression.
// Treating punctuation literally prevents callers from supplying arbitrary regular expressions.
const escapeRegularExpression = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Builds the Company search, Client join, deterministic pagination, and response projection.
// A facet derives page rows and total count from the same filtered Company result set.
export const buildGetClientCompaniesPipeline = ({ page, limit, search }) => {
  const pipeline = [];

  if (search) {
    pipeline.push({
      $match: {
        companyName: new RegExp(escapeRegularExpression(search), "i"),
      },
    });
  }

  pipeline.push(
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
              id: { $toString: "$_id" },
              client: {
                $convert: {
                  input: "$client",
                  to: "string",
                  onError: null,
                  onNull: null,
                },
              },
              companyName: { $ifNull: ["$companyName", null] },
              tradeLicenceNumber: {
                $ifNull: ["$tradeLicenceNumber", null],
              },
              licenceExpiryDate: {
                $ifNull: ["$licenceExpiryDate", null],
              },
              vatTaxRegistrationNumber: {
                $ifNull: ["$vatTaxRegistrationNumber", null],
              },
              corporateTaxNumber: {
                $ifNull: ["$corporateTaxNumber", null],
              },
              clientName: { $ifNull: ["$clientInformation.name", null] },
              clientStatus: {
                $ifNull: ["$clientInformation.status", null],
              },
              nationality: {
                $ifNull: ["$clientInformation.nationality", null],
              },
              version: { $ifNull: ["$version", 0] },
              createdAt: 1,
              updatedAt: 1,
            },
          },
        ],
        metadata: [{ $count: "total" }],
      },
    }
  );

  return pipeline;
};

// Executes the Company aggregation with case-insensitive collation and builds page metadata.
// Empty result sets return a stable empty list with zero total and totalPages values.
export const getClientCompanies = async (query) => {
  const pipeline = buildGetClientCompaniesPipeline(query);
  const [result = { data: [], metadata: [] }] = await ClientCompany.aggregate(
    pipeline
  )
    .collation({ locale: "en", strength: 2 })
    .exec();
  const total = result.metadata[0]?.total ?? 0;

  return {
    companies: result.data,
    page: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
    },
  };
};
