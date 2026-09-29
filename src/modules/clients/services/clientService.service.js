import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import { ClientServiceNotFoundError } from "../errors/clientService.error.js";
import { prepareVatServiceCreation } from "./clientVatCreation.service.js";
import { ClientVatError, normalizeVatError } from "../errors/clientVat.error.js";
import { assertVatVersion, VAT_SERVICE_CODE, parseVatDate } from "../utils/clientVat.utils.js";
import Client from "../models/client.model.js";
import ClientService from "../models/clientService.model.js";

// Creates one Service after confirming that the owning Client exists.
// The server injects the Client reference so callers cannot attach records arbitrarily.
export const createClientService = async (clientId, serviceInformation) => {
  const clientExists = await Client.exists({ _id: clientId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  const values = await prepareVatServiceCreation(clientId, serviceInformation);
  try {
    return await ClientService.create({ ...values, client: clientId });
  } catch (error) { throw normalizeVatError(error); }
};

// Updates one Service using only its validated MongoDB id and editable fields.
// Loading and saving preserves Mongoose validation and optimistic version increments.
export const updateClientService = async (serviceId, serviceInformation) => {
  const service = await ClientService.findById(serviceId).exec();

  if (!service) {
    throw new ClientServiceNotFoundError();
  }

  const { expectedVersion, ...changes } = serviceInformation;
  if (service.serviceCode === VAT_SERVICE_CODE) {
    assertVatVersion(service, expectedVersion);
    if (Object.keys(changes).some((field) => !["packagePrice", "paymentStatus", "targetCompletionDate", "notes"].includes(field))) throw new ClientVatError("VAT_ACTION_REQUIRED", "Use a VAT action to change workflow or period.", 409);
    if (changes.targetCompletionDate) parseVatDate(changes.targetCompletionDate);
  } else if (expectedVersion !== undefined) assertVatVersion(service, expectedVersion);
  service.set(changes);
  try { await service.save(); } catch (error) { throw normalizeVatError(error); }
  return service;
};

// Deletes one Service selected by its validated MongoDB identifier.
// A missing record produces the stable Client Service not-found response.
export const deleteClientService = async (serviceId) => {
  const existing = await ClientService.findById(serviceId).exec();
  if (!existing) throw new ClientServiceNotFoundError();
  if (existing.serviceCode === VAT_SERVICE_CODE) throw new ClientVatError("VAT_HISTORY_RETAINED", "VAT filings must be cancelled instead of deleted.", 409);
  const service = await ClientService.findByIdAndDelete(serviceId).exec();

  if (!service) {
    throw new ClientServiceNotFoundError();
  }

  return service;
};
