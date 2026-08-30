import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import Client from "../models/client.model.js";

// Updates only the validated Client information fields for one MongoDB identifier.
// Loading before saving preserves Mongoose validation and optimistic version increments.
export const updateClientInformation = async (clientId, clientInformation) => {
  const client = await Client.findById(clientId).exec();

  if (!client) {
    throw new ClientNotFoundError();
  }

  client.set(clientInformation);
  await client.save();

  return client;
};
