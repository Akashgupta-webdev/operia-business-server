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
// Explicitly includes the password only in this Admin detail response; related arrays are deterministic.
export const getClientDetails = async (clientId) => {
  const client = await Client.findById(clientId).select("+password").exec();
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
    client: { ...client.toJSON(), password: client.password ?? null },
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
