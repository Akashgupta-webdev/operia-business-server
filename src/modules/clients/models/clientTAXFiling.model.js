import mongoose from "mongoose";
import { createClientFilingSchema } from "./clientFiling.schema.js";

export const clientTAXFilingSchema = createClientFilingSchema("clientTAXFilings");
const ClientTAXFiling = mongoose.models.ClientTAXFiling
  || mongoose.model("ClientTAXFiling", clientTAXFilingSchema);

export default ClientTAXFiling;
