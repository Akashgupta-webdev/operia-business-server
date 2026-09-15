import logger from "../../../logger/index.js";
import { updateClientCredentials as updateClientCredentialsService } from "../services/clientCredentials.service.js";

// Updates an Admin-selected Client's portal credentials and returns the safe Client representation.
// Logs identify the actor and target without exposing the email or password.
export const updateClientCredentials = async (req, res, next) => {
  const context = {
    clientId: req.validatedParams?.id,
    actorId: req.user?.id,
    correlationId: req.correlationId,
  };
  try {
    const client = await updateClientCredentialsService(req.validatedParams.id, req.validatedBody);
    logger.info("Client credentials updated.", context);
    res.set("ETag", `"${client.version}"`);
    return res.status(200).json({ data: client, meta: { correlationId: req.correlationId } });
  } catch (error) {
    console.error("Client credentials update failed.", { errorName: error.name });
    logger.error("Client credentials update failed.", { ...context, errorName: error.name });
    return next(error);
  }
};
