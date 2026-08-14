import { Router } from "express";

import { authorize } from "../../../middleware/authorize.middleware.js";
import {
  createCompleteClientService,
  createClient,
  editClientService,
  getClient,
  getCompleteClientService,
  listClientServices,
  listClients,
  updateClient,
} from "../controllers/client.controller.js";
import { uploadClientServiceDocuments } from "../middleware/client-service-upload.middleware.js";
import {
  validateClientId,
  validateCreateClient,
  validateCreateClientWithService,
  validateEditClientService,
  validateGetClientService,
  validateListClientServices,
  validateListClientsQuery,
  validateUpdateClient,
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
clientRouter.get(
  "/:clientMongoId/services",
  authorize("ADMIN"),
  validateListClientServices,
  listClientServices
);
clientRouter.patch(
  "/:clientMongoId/services/:serviceId",
  authorize("ADMIN"),
  validateEditClientService,
  editClientService
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
clientRouter.patch(
  "/:clientId",
  authorize("ADMIN"),
  validateUpdateClient,
  updateClient
);
clientRouter.get(
  "/:clientId",
  authorize("ADMIN"),
  validateClientId,
  getClient
);

export default clientRouter;
