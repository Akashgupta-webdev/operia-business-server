import { ClientCompanyNotFoundError } from "../errors/clientCompanyUpdate.error.js";
import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";

// Updates only supplied compliance due dates on the Company selected by its own id.
// Document saving preserves model validation, omitted dates, and optimistic concurrency.
export const updateNextVATorTAXDueDate = async (companyId, dueDates) => {
  const company = await ClientCompany.findById(companyId).exec();
  if (!company) {
    throw new ClientCompanyNotFoundError();
  }
  for (const field of ["nextVATDue", "nextTAXDue"]) {
    if (dueDates[field] !== undefined) {
      company.set(`complianceDueDate.${field}`, dueDates[field]);
    }
  }
  await company.save();
  return company;
};

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
    if (["tradeLicence", "establishment", "civilDefenceCertificate", "commercialTradeLicence"].includes(field) && value !== null) {
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
