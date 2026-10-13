import "dotenv/config";
import mongoose from "mongoose";
import ClientVATFiling from "../src/modules/clients/models/clientVATFiling.model.js";
import ClientTAXFiling from "../src/modules/clients/models/clientTAXFiling.model.js";

// Creates indexes for the two new standalone filing collections without changing legacy filings.
// Deployment can rerun this migration without dropping unrelated indexes or rewriting records.
async function migrateClientFilingIndexes() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    await ClientVATFiling.createIndexes();
    await ClientTAXFiling.createIndexes();
    console.log("Client filing indexes created.");
  } finally {
    await mongoose.disconnect();
  }
}

// Reports a safe migration failure and returns a failing exit status for deployment tooling.
// Connection details and raw database errors are never logged.
migrateClientFilingIndexes().catch(function reportMigrationFailure(error) {
  console.error("Client filing index migration failed.", { name: error.name, code: error.code });
  process.exitCode = 1;
});
