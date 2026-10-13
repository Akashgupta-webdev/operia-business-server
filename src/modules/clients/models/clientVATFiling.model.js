import mongoose from "mongoose";
import { createClientFilingSchema } from "./clientFiling.schema.js";

export const clientVATFilingSchema = createClientFilingSchema("clientVATFilings");
const ClientVATFiling = mongoose.models.ClientVATFiling
  || mongoose.model("ClientVATFiling", clientVATFilingSchema);

export default ClientVATFiling;
