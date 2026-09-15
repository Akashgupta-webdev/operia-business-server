import { updateClientInformation } from "./clientUpdate.service.js";
import { updateClientCredentialsSchema } from "../validators/clientCredentials.validator.js";
import { ClientUpdateValidationError } from "../errors/clientUpdate.error.js";

// Stores the supplied portal password unchanged and saves both credentials in one versioned update.
// Revalidating the allow-list protects direct service callers and preserves omitted fields.
export const updateClientCredentials = async (clientId, credentials) => {
  const { error, value } = updateClientCredentialsSchema.validate(credentials);
  if (error) {
    throw new ClientUpdateValidationError([{ field: "credentials", issue: "Invalid client credentials." }]);
  }
  return updateClientInformation(clientId, value);
};
