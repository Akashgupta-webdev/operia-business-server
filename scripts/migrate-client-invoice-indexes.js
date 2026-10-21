import "dotenv/config";
import fs from "node:fs/promises";
import mongoose from "mongoose";
import ClientInvoice from "../src/modules/clients/models/clientInvoice.model.js";
import Counter from "../src/modules/common/models/counter.model.js";
import { validateInvoiceReferences } from "../src/modules/clients/services/clientInvoicePersistence.service.js";

// Validates explicit legacy replacements before changing documents or indexes.
// Run with writes stopped; the default dry run performs no database mutations.
async function migrateClientInvoiceIndexes() {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");
  const mapping = process.env.INVOICE_MIGRATION_FILE
    ? JSON.parse(await fs.readFile(process.env.INVOICE_MIGRATION_FILE, "utf8")) : {};
  try {
    await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false, autoCreate: false });
    const replacements = [];
    const sequences = new Map();
    const numbers = new Set();
    for await (const existing of ClientInvoice.collection.find({})) {
      const legacy = !existing.clientId || !existing.service;
      const fields = legacy ? mapping[String(existing._id)] : existing;
      if (!fields) throw new Error("Legacy invoice requires an explicit migration mapping: " + existing._id);
      const invoice = new ClientInvoice({
        ...fields, _id: existing._id, invoiceNo: existing.invoiceNo ?? existing.invoiceNumber,
        createdAt: existing.createdAt, updatedAt: existing.updatedAt, version: existing.version ?? 0,
      });
      await invoice.validate();
      await validateInvoiceReferences(invoice);
      if (!invoice.invoiceNo || numbers.has(invoice.invoiceNo)) throw new Error("Missing or duplicate invoice number.");
      numbers.add(invoice.invoiceNo);
      const match = /^OP-(\d{4})-(\d+)$/.exec(invoice.invoiceNo);
      if (match) {
        const count = Number(match[2]);
        if (!Number.isSafeInteger(count)) throw new Error("Invalid existing sequence.");
        sequences.set(match[1], Math.max(sequences.get(match[1]) ?? 0, count));
      }
      replacements.push(invoice.toObject());
    }
    if (!process.argv.includes("--apply")) {
      console.log("Validated " + replacements.length + " invoices; no changes made. Use --apply after review.");
      return;
    }
    // Remove obsolete unique indexes before replacing legacy fields.
    // Otherwise multiple converted invoices would collide on missing invoiceNumber.
    const collections = await mongoose.connection.db.listCollections({ name: "clientInvoices" }).toArray();
    const indexes = collections.length ? await ClientInvoice.collection.indexes() : [];
    for (const index of indexes) {
      if (index.key.invoiceNumber || index.key.client) await ClientInvoice.collection.dropIndex(index.name);
    }
    // Raw collection replacements intentionally preserve historical identity.
    // All replacement documents have already passed the new model validation.
    for (const document of replacements) await ClientInvoice.collection.replaceOne({ _id: document._id }, document);
    await ClientInvoice.createIndexes();
    await Counter.createIndexes();
    for (const [year, count] of sequences) {
      await Counter.updateOne({ name: "client-invoice-" + year }, { $max: { count } },
        { upsert: true, setDefaultsOnInsert: false });
    }
    console.log("Invoice schema and indexes migrated.");
  } finally {
    await mongoose.disconnect();
  }
}

// Reports actionable migration failures without printing connection credentials.
// Deployment tooling receives a failing exit code and must keep writes stopped.
migrateClientInvoiceIndexes().catch(function reportMigrationFailure(error) {
  console.error("Client invoice migration failed.", { name: error.name, message: error.message });
  process.exitCode = 1;
});
