import "dotenv/config";
import mongoose from "mongoose";
import ClientVATFiling from "../src/modules/clients/models/clientVATFiling.model.js";
import ClientTAXFiling from "../src/modules/clients/models/clientTAXFiling.model.js";
import { CLIENT_FILING_STATUSES } from "../src/modules/clients/models/clientFiling.schema.js";

// Converts known lowercase filing statuses and removes obsolete standalone stage fields.
// Reruns are safe; raw collection updates preserve timestamps and advance changed versions.
async function migrateClientFilingStatuses() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    for (const Model of [ClientVATFiling, ClientTAXFiling]) {
      for (const status of CLIENT_FILING_STATUSES) {
        await Model.collection.updateMany(
          { status: status.toLowerCase() },
          { $set: { status }, $unset: { stage: "" }, $inc: { version: 1 } }
        );
      }
      await Model.collection.updateMany(
        { status: { $in: CLIENT_FILING_STATUSES }, stage: { $exists: true } },
        { $unset: { stage: "" }, $inc: { version: 1 } }
      );
      const unresolved = await Model.collection.countDocuments({ status: { $nin: CLIENT_FILING_STATUSES } });
      console.log(`${Model.modelName}: ${unresolved} records require status review.`);
      if (unresolved) process.exitCode = 1;
    }
  } finally {
    await mongoose.disconnect();
  }
}

// Reports migration failure without exposing connection details or database contents.
// A nonzero exit code prevents deployment tooling from treating failure as success.
migrateClientFilingStatuses().catch(function reportMigrationFailure(error) {
  console.error("Client filing status migration failed.", { name: error.name, code: error.code });
  process.exitCode = 1;
});
