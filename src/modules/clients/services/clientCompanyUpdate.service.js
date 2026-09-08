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

  for (const [field, value] of Object.entries(companyInformation)) {
    if ((field === "tradeLicence" || field === "establishment") && value !== null) {
      for (const [nestedField, nestedValue] of Object.entries(value)) {
        company.set(`${field}.${nestedField}`, nestedValue);
      }
    } else {
      company.set(field, value);
    }
  }
  await company.save();

  return company;
};
