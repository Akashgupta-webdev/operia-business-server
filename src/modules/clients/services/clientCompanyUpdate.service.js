import { ClientCompanyNotFoundError } from "../errors/clientCompanyUpdate.error.js";
import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";

// Updates the Company associated with one validated Client MongoDB identifier.
// Loading and saving the document preserves model validation and optimistic concurrency.
export const updateClientCompanyInformation = async (
  clientId,
  companyInformation
) => {
  const clientExists = await Client.exists({ _id: clientId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  const company = await ClientCompany.findOne({ client: clientId }).exec();

  if (!company) {
    throw new ClientCompanyNotFoundError();
  }

  company.set(companyInformation);
  await company.save();

  return company;
};
