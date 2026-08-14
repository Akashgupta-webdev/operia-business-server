import { Router } from "express";

import { authorize } from "../../../middleware/authorize.middleware.js";
import {
  createCompleteClientService,
  createClient,
  getClient,
  getCompleteClientService,
  listClients,
} from "../controllers/client.controller.js";
import { uploadClientServiceDocuments } from "../middleware/client-service-upload.middleware.js";
import {
  validateClientId,
  validateCreateClient,
  validateCreateClientWithService,
  validateGetClientService,
  validateListClientsQuery,
} from "../validators/client.validator.js";

const clientRouter = Router();

clientRouter.post(
  "/with-service",
  authorize("ADMIN"),
  uploadClientServiceDocuments,
  validateCreateClientWithService,
  createCompleteClientService
);
clientRouter.get(
  "/:clientId/with-service/:serviceId",
  authorize("ADMIN"),
  validateGetClientService,
  getCompleteClientService
);

clientRouter.post(
  "/",
  authorize("ADMIN"),
  validateCreateClient,
  createClient
);
clientRouter.get(
  "/",
  authorize("ADMIN"),
  validateListClientsQuery,
  listClients
);
clientRouter.get(
  "/:clientId",
  authorize("ADMIN"),
  validateClientId,
  getClient
);

export default clientRouter;
