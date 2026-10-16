import mongoose from "mongoose";
import ClientCompany from "../models/clientCompany.model.js";
import ClientVATFiling from "../models/clientVATFiling.model.js";
import ClientTAXFiling from "../models/clientTAXFiling.model.js";
import { ClientCompanyNotFoundError } from "../errors/clientCompanyUpdate.error.js";
import { ClientFilingError } from "../errors/clientFiling.error.js";

const filingModels = { VAT: ClientVATFiling, TAX: ClientTAXFiling };
const editableFields = ["periodStart", "periodEnd", "status", "input", "output", "filingDate", "nextDueDate"];

// Creates or updates one filing and synchronizes only its corresponding company deadline.
// A MongoDB transaction prevents partial writes and document saves enforce optimistic concurrency.
export async function saveClientFiling(type, action, id, body) {
  const Model = filingModels[type];
  return mongoose.connection.transaction(async function saveFilingTransaction(session) {
    const filing = action === "create" ? new Model() : await Model.findById(id).session(session).exec();
    if (!filing) throw new ClientFilingError("CLIENT_FILING_NOT_FOUND", "The requested filing was not found.", 404);
    const company = await ClientCompany.findById(action === "create" ? id : filing.company).session(session).exec();
    if (!company) throw new ClientCompanyNotFoundError();
    if (action === "create") {
      filing.client = company.client;
      filing.company = company._id;
    } else if (String(filing.client) !== String(company.client)) {
      throw new ClientFilingError("FILING_COMPANY_MISMATCH", "The filing does not belong to the company's client.", 409);
    }
    for (const field of editableFields) {
      if (body[field] !== undefined) filing.set(field, body[field]);
    }
    await filing.save({ session });
    if (body.nextDueDate !== undefined) {
      company.set(`complianceDueDate.next${type}Due`, filing.nextDueDate);
      await company.save({ session });
    }
    return filing;
  });
}

// Deletes a single filing from the route-selected VAT or TAX collection by its own id.
// Company deadlines remain unchanged because deleting history does not define a replacement deadline.
export async function deleteClientFiling(type, id) {
  const filing = await filingModels[type].findOneAndDelete({ _id: id }).exec();
  if (!filing) throw new ClientFilingError("CLIENT_FILING_NOT_FOUND", "The requested filing was not found.", 404);
  return { id: filing._id.toString(), deleted: true };
}
