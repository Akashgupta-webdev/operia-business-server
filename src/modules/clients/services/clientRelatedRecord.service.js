import { ClientNotFoundError } from "../errors/clientDetail.error.js";
import { ClientRelatedRecordNotFoundError } from "../errors/clientRelatedRecord.error.js";
import Client from "../models/client.model.js";
import ClientDriver from "../models/clientDrivers.model.js";
import ClientMember from "../models/clientMembers.model.js";
import ClientVehicle from "../models/clientVehicles.model.js";

const relatedRecordModels = Object.freeze({
  member: ClientMember,
  vehicle: ClientVehicle,
  driver: ClientDriver,
});

// Creates one related record after confirming that its owning Client exists.
// The server injects the Client reference so callers cannot attach records arbitrarily.
const createClientRelatedRecord = async (clientId, values, actionOn) => {
  const clientExists = await Client.exists({ _id: clientId });

  if (!clientExists) {
    throw new ClientNotFoundError();
  }

  const RelatedRecord = relatedRecordModels[actionOn];
  return RelatedRecord.create({ ...values, client: clientId });
};

// Creates a Client Member for one validated owning Client identifier.
// The shared helper provides the Client existence check and reference injection.
export const createClientMember = (clientId, values) =>
  createClientRelatedRecord(clientId, values, "member");

// Creates a Client Vehicle for one validated owning Client identifier.
// The shared helper provides the Client existence check and reference injection.
export const createClientVehicle = (clientId, values) =>
  createClientRelatedRecord(clientId, values, "vehicle");

// Creates a Client Driver for one validated owning Client identifier.
// The shared helper provides the Client existence check and reference injection.
export const createClientDriver = (clientId, values) =>
  createClientRelatedRecord(clientId, values, "driver");

// Updates one validated related record while preserving Mongoose validation and versioning.
// The private model map prevents request data from being used as a collection or model name.
const updateClientRelatedRecord = async (recordId, changes, actionOn) => {
  const RelatedRecord = relatedRecordModels[actionOn];
  const record = await RelatedRecord.findById(recordId).exec();

  if (!record) {
    throw new ClientRelatedRecordNotFoundError(actionOn);
  }

  record.set(changes);
  await record.save();
  return record;
};

// Updates a Client Member selected by its validated MongoDB identifier.
// This named service keeps the controller independent from model implementation details.
export const updateClientMember = (recordId, changes) =>
  updateClientRelatedRecord(recordId, changes, "member");

// Updates a Client Vehicle selected by its validated MongoDB identifier.
// This named service keeps the controller independent from model implementation details.
export const updateClientVehicle = (recordId, changes) =>
  updateClientRelatedRecord(recordId, changes, "vehicle");

// Updates a Client Driver selected by its validated MongoDB identifier.
// This named service keeps the controller independent from model implementation details.
export const updateClientDriver = (recordId, changes) =>
  updateClientRelatedRecord(recordId, changes, "driver");

// Deletes one validated Member, Vehicle, or Driver by MongoDB identifier.
// Model selection remains constrained to the internal allow-list used by update operations.
export const deleteClientRelatedRecord = async (recordId, actionOn) => {
  const RelatedRecord = relatedRecordModels[actionOn];
  const record = await RelatedRecord.findByIdAndDelete(recordId).exec();

  if (!record) {
    throw new ClientRelatedRecordNotFoundError(actionOn);
  }

  return record;
};
