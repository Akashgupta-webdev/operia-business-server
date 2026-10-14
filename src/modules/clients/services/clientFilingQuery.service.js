import Client from "../models/client.model.js";
import ClientVATFiling from "../models/clientVATFiling.model.js";
import ClientTAXFiling from "../models/clientTAXFiling.model.js";
import { ClientNotFoundError } from "../errors/clientDetail.error.js";

// Creates a client-scoped filing reader for one fixed collection.
// Hydrated results preserve the payableTax virtual and existing JSON serialization.
function createClientFilingListService(Model) {
  return async function getClientFilings(clientId, { page, limit }) {
    if (!await Client.exists({ _id: clientId })) throw new ClientNotFoundError();
    const filter = { client: clientId };
    const [filings, total] = await Promise.all([
      Model.find(filter).sort({ filingDate: -1, _id: -1 })
        .skip((page - 1) * limit).limit(limit).exec(),
      Model.countDocuments(filter).exec(),
    ]);
    return { filings, page: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  };
}

export const getClientVATFilings = createClientFilingListService(ClientVATFiling);
export const getClientTAXFilings = createClientFilingListService(ClientTAXFiling);
