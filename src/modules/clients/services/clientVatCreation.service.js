import ClientCompany from "../models/clientCompany.model.js";
import User from "../../user/models/user.model.js";
import { ClientVatError } from "../errors/clientVat.error.js";
import { parseVatDate, validateVatPeriod, VAT_PACKAGE, VAT_SERVICE_CODE } from "../utils/clientVat.utils.js";

// Confirms assigned staff are active Admins before accepting a VAT assignment.
// Assigned-agent permissions are not enabled in this release.
export const validateVatAssignee = async (assignedTo, session = null) => {
  if (assignedTo && !await User.exists({ _id: assignedTo, role: "ADMIN", status: "ACTIVE" }).session(session)) throw new ClientVatError("VALIDATION_FAILED", "Assignee must be an active Admin.");
};

// Prepares VAT data through the same rules for standalone and aggregate creation.
// Company ownership, tax identity and real period dates are checked before writes.
export const prepareVatServiceCreation = async (clientId, input, { session = null, company: aggregateCompany } = {}) => {
  if (!input.serviceCode) {
    if (input.details || input.company || input.dueDate || input.assignedTo) throw new ClientVatError("VALIDATION_FAILED", "VAT-specific fields require serviceCode VAT_RETURN_FILING.");
    return input;
  }
  if (input.serviceCode !== VAT_SERVICE_CODE || input.category !== "Tax & Accounting" || input.package !== VAT_PACKAGE || !input.details?.vat || !input.dueDate || (input.status && input.status !== "Pending")) throw new ClientVatError("VALIDATION_FAILED", "VAT requires its tax category/package, period, deadline and Pending initial status.");
  if (aggregateCompany && input.company) throw new ClientVatError("VALIDATION_FAILED", "Aggregate creation uses the newly created company; omit company on its VAT service.");
  const company = aggregateCompany ?? (input.company ? await ClientCompany.findOne({ _id: input.company, client: clientId }).session(session).exec() : null);
  if (!company || String(company.client) !== String(clientId)) throw new ClientVatError("VALIDATION_FAILED", "Select a company belonging to this Client.");
  if (!/^\d{15}$/.test(company.vatTaxRegistrationNumber ?? "")) throw new ClientVatError("VALIDATION_FAILED", "The company needs a valid 15-digit VAT TRN.");
  await validateVatAssignee(input.assignedTo, session);
  const periodStart = parseVatDate(input.details.vat.periodStart), periodEnd = parseVatDate(input.details.vat.periodEnd), dueDate = parseVatDate(input.dueDate);
  validateVatPeriod(periodStart, periodEnd, dueDate);
  return { ...input, company: company._id, status: "Pending", dueDate, details: { vat: { trn: company.vatTaxRegistrationNumber, periodStart, periodEnd } } };
};
