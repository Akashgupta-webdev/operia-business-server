import Client from "../models/client.model.js";
import ClientVATFiling from "../models/clientVATFiling.model.js";
import ClientTAXFiling from "../models/clientTAXFiling.model.js";
import { buildGetClientsPipeline, executeClientListPipeline } from "./clientQuery.service.js";
import { vatToday } from "../utils/clientVat.utils.js";

// Extends the existing compliance list with the latest VAT filing for each page row.
// Both dates come from the same record, ordered by filingDate with an id tie-breaker.
export function buildAddedComplianceClientsPipeline(query) {
  const pipeline = buildGetClientsPipeline(query, {
    complianceService: true,
    includeVatRegistration: true,
  });
  const data = pipeline.at(-1).$facet.data;
  data.splice(data.length - 1, 0, {
    $lookup: {
      from: ClientVATFiling.collection.name,
      let: { clientId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$client", "$$clientId"] }, filingDate: { $type: "date" } } },
        { $sort: { filingDate: -1, _id: -1 } },
        { $limit: 1 },
        { $project: { filingDate: 1, nextDueDate: 1 } },
      ],
      as: "latestVatFiling",
    },
  });
  Object.assign(data.at(-1).$project, {
    lastFilingDate: { $ifNull: [{ $arrayElemAt: ["$latestVatFiling.filingDate", 0] }, null] },
    nextDueDate: { $ifNull: [{ $arrayElemAt: ["$latestVatFiling.nextDueDate", 0] }, null] },
  });
  return pipeline;
}

// Counts completed filings and upcoming actions across every enabled Client.
// Search and pagination never restrict these metrics; today is the existing UAE calendar day.
export function buildComplianceMetricsPipeline(now = new Date()) {
  const today = vatToday(now);
  const horizon = new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000);
  const pipeline = [{ $match: { complianceService: true } }];
  for (const [model, as] of [[ClientVATFiling, "vatMetrics"], [ClientTAXFiling, "taxMetrics"]]) {
    pipeline.push({
      $lookup: {
        from: model.collection.name,
        let: { clientId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$client", "$$clientId"] }, status: { $in: ["pending", "complete"] } } },
          { $group: {
            _id: null,
            totalTaxFilings: { $sum: { $cond: [{ $eq: ["$status", "complete"] }, 1, 0] } },
            actionRequired: { $sum: { $cond: [{ $and: [
              { $gt: ["$nextDueDate", today] },
              { $lte: ["$nextDueDate", horizon] },
            ] }, 1, 0] } },
          } },
        ],
        as,
      },
    });
  }
  const totals = {};
  for (const field of ["totalTaxFilings", "actionRequired"]) {
    totals[field] = { $sum: { $add: [
      { $ifNull: [{ $arrayElemAt: [`$vatMetrics.${field}`, 0] }, 0] },
      { $ifNull: [{ $arrayElemAt: [`$taxMetrics.${field}`, 0] }, 0] },
    ] } };
  }
  pipeline.push({ $group: { _id: null, ...totals } }, { $project: { _id: 0, totalTaxFilings: 1, actionRequired: 1 } });
  return pipeline;
}

// Fetches the enriched page and global filing totals through the service layer.
// Missing filings or an empty enabled-client population produce explicit zero metrics.
export async function getAddedComplianceClients(query, now = new Date()) {
  const [result, metrics] = await Promise.all([
    executeClientListPipeline(query, buildAddedComplianceClientsPipeline(query)),
    Client.aggregate(buildComplianceMetricsPipeline(now)).exec(),
  ]);
  return {
    ...result,
    metrics: {
      totalTaxFilings: metrics[0]?.totalTaxFilings ?? 0,
      actionRequired: metrics[0]?.actionRequired ?? 0,
    },
  };
}
