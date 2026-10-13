import Client from "../models/client.model.js";

// Backfills the membership default only on legacy Clients that lack the field.
// Repeated runs preserve explicit membership values and existing timestamps.
export const backfillClientComplianceService = async () => Client.updateMany(
  { complianceService: { $exists: false } },
  { $set: { complianceService: false } },
  { timestamps: false }
).exec();
