import "dotenv/config";
import mongoose from "mongoose";
import ClientService from "../src/modules/clients/models/clientService.model.js";
import ClientDocument from "../src/modules/clients/models/clientDocuments.model.js";
import ClientReminder from "../src/modules/clients/models/clientReminder.model.js";

// Adds VAT indexes without rewriting legacy records or dropping existing indexes.
// Run before enabling VAT writes against a backed-up replica-set deployment.
async function migrateVatIndexes() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });
    for (const model of [ClientService, ClientDocument, ClientReminder]) await model.createIndexes();
    console.log("VAT indexes created.");
  } finally {
    await mongoose.disconnect();
  }
}
migrateVatIndexes().catch(function reportMigrationFailure(error) {
  console.error("VAT index migration failed.", { name: error.name, code: error.code });
  process.exitCode = 1;
});
