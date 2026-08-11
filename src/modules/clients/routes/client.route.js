import { Router } from "express";

import { authorize } from "../../../middleware/authorize.middleware.js";
import {
  createClient,
  getClient,
  listClients,
} from "../controllers/client.controller.js";
import {
  validateClientId,
  validateCreateClient,
  validateListClientsQuery,
} from "../validators/client.validator.js";

const clientRouter = Router();

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
