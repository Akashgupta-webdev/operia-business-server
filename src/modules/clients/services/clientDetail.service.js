import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import Client from "../models/client.model.js";
import ClientCompany from "../models/clientCompany.model.js";
import ClientDocument from "../models/clientDocuments.model.js";
import ClientDriver from "../models/clientDrivers.model.js";
import ClientMember from "../models/clientMembers.model.js";
import ClientPayment from "../models/clientPayment.model.js";
import ClientReminder from "../models/clientReminder.model.js";
import ClientService from "../models/clientService.model.js";
import ClientVehicle from "../models/clientVehicles.model.js";

const RELATED_RECORD_SORT = Object.freeze({ createdAt: -1, _id: 1 });

// Loads one Client and every collection that directly references its MongoDB identifier.
// Related lookups run together and return deterministic arrays, including when they are empty.
export const getClientDetails = async (clientId) => {
  const client = await Client.findById(clientId);
  if (!client) {
    throw new ClientNotFoundError();
  }

  const relatedFilter = { client: clientId };
  const [
    companies,
    members,
    vehicles,
    drivers,
    services,
    documents,
    payments,
    reminders,
  ] = await Promise.all([
    ClientCompany.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientMember.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientVehicle.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientDriver.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientService.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientDocument.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientPayment.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
    ClientReminder.find(relatedFilter).sort(RELATED_RECORD_SORT).exec(),
  ]);

  return {
    client,
    companies,
    members,
    vehicles,
    drivers,
    services,
    documents,
    payments,
    reminders,
  };
};
