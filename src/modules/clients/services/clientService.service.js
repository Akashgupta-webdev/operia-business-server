import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import { ClientServiceNotFoundError } from "../errors/clientService.error.js";
import Client from "../models/client.model.js";
import ClientService from "../models/clientService.model.js";

// Creates one Service after confirming that the owning Client exists.
// The server injects the Client reference so callers cannot attach records arbitrarily.
export const createClientService = async (clientId, serviceInformation) => {
  const clientExists = await Client.exists({ _id: clientId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  return ClientService.create({ ...serviceInformation, client: clientId });
};

// Updates one Service using only its validated MongoDB id and editable fields.
// Loading and saving preserves Mongoose validation and optimistic version increments.
export const updateClientService = async (serviceId, serviceInformation) => {
  const service = await ClientService.findById(serviceId).exec();

  if (!service) {
    throw new ClientServiceNotFoundError();
  }

  service.set(serviceInformation);
  await service.save();
  return service;
};

// Deletes one Service selected by its validated MongoDB identifier.
// A missing record produces the stable Client Service not-found response.
export const deleteClientService = async (serviceId) => {
  const service = await ClientService.findByIdAndDelete(serviceId).exec();

  if (!service) {
    throw new ClientServiceNotFoundError();
  }

  return service;
};
