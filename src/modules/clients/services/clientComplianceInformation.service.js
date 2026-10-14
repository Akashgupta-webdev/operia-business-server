import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";
import ClientVATFiling from "../models/clientVATFiling.model.js";
import ClientTAXFiling from "../models/clientTAXFiling.model.js";
import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import { vatToday } from "../utils/clientVat.utils.js";

// Loads one client's compliance information using the newest associated company.
// Filing totals span the client's companies; deadline metrics use only the displayed company.
export async function getClientInformationForCompliance(clientId, now = new Date()) {
  const client = await Client.findById(clientId)
    .select("_id name nationality mobileNumber emailAddress status").lean().exec();
  if (!client) throw new ClientNotFoundError();

  const [company, vat, tax] = await Promise.all([
    ClientCompany.findOne({ client: clientId }).sort({ createdAt: -1, _id: 1 })
      .select("companyName vatTaxRegistrationNumber corporateTaxNumber complianceDueDate").lean().exec(),
    ClientVATFiling.countDocuments({ client: clientId, status: "paid" }).exec(),
    ClientTAXFiling.countDocuments({ client: clientId, status: "paid" }).exec(),
  ]);
  const information = {};
  for (const field of ["_id", "name", "nationality", "mobileNumber", "emailAddress", "status"]) {
    information[field] = client[field] ?? null;
  }
  for (const field of ["companyName", "vatTaxRegistrationNumber", "corporateTaxNumber"]) {
    information[field] = company?.[field] ?? null;
  }
  const today = vatToday(now);
  const horizon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
  const metrics = { totalFiling: vat + tax, dueSoon: 0, overdue: 0 };
  for (const field of ["nextVATDue", "nextTAXDue"]) {
    const due = company?.complianceDueDate?.[field] ?? null;
    information[field] = due;
    if (due == null) continue;
    if (due < today) metrics.overdue += 1;
    else if (due <= horizon) metrics.dueSoon += 1;
  }
  return { information, metrics };
}
