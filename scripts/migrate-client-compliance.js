import "dotenv/config";
import mongoose from "mongoose";
import { backfillClientComplianceService } from "../src/modules/clients/services/clientComplianceMigration.service.js";

// Connects to the configured database and backfills legacy Client membership defaults.
// Always disconnects and leaves existing true or false values untouched.
async function migrateClientCompliance() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    const result = await backfillClientComplianceService();
    console.log("Client compliance defaults migrated.", { modifiedCount: result.modifiedCount });
  } finally {
    await mongoose.disconnect();
  }
}

// Reports migration failure without exposing database connection details.
// A nonzero exit status allows deployment tooling to detect an incomplete migration.
migrateClientCompliance().catch(function reportMigrationFailure(error) {
  console.error("Client compliance migration failed.", { name: error.name, code: error.code });
  process.exitCode = 1;
});
