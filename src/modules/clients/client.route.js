import express from "express";

import { authorize } from "../../middleware/authorize.middleware.js";
import {
  uploadClientServiceDocuments,
  uploadSingleClientDocument,
} from "../../middleware/uploadClientDocument.middleware.js";
import {
  createClient,
  getClientDetails,
  getClients,
  updateClientInformation,
} from "./controller/client.controller.js";
import {
  getClientCompanies,
  updateClientCompanyInformation,
} from "./controller/clientCompany.controller.js";
import { getClientDashboardKPI } from "./controller/clientDashboard.controller.js";
import {
  addClientDocument,
  deleteDocument,
} from "./controller/clientDocument.controller.js";
import {
  createClientService,
  deleteClientService,
  updateClientService,
} from "./controller/clientService.controller.js";
import {
  createClientDriver,
  createClientMember,
  createClientVehicle,
  deleteClientRelatedRecord,
  updateClientDriver,
  updateClientMember,
  updateClientVehicle,
} from "./controller/clientRelatedRecord.controller.js";
import {
  validateCreateClient,
  validateUpdateClientInformation,
} from "./validators/clientBody.validator.js";
import { validateUpdateClientCompanyInformation } from "./validators/clientCompanyBody.validator.js";
import { validateGetClientCompanies } from "./validators/clientCompanyQuery.validator.js";
import { validateGetClientDashboardKPI } from "./validators/clientDashboard.validator.js";
import {
  validateAddClientDocument,
  validateDeleteClientDocument,
} from "./validators/clientDocument.validator.js";
import { validateGetClientDetails } from "./validators/clientParams.validator.js";
import { validateGetClients } from "./validators/clientQuery.validator.js";
import {
  validateCreateClientService,
  validateDeleteClientService,
  validateUpdateClientService,
} from "./validators/clientService.validator.js";
import {
  validateCreateClientDriver,
  validateCreateClientMember,
  validateCreateClientVehicle,
  validateDeleteClientRelatedRecord,
  validateUpdateClientDriver,
  validateUpdateClientMember,
  validateUpdateClientVehicle,
} from "./validators/clientRelatedRecord.validator.js";

const ClientRoute = express.Router();

ClientRoute.post(
  "/",
  authorize("ADMIN"),
  uploadClientServiceDocuments,
  validateCreateClient,
  createClient
);

ClientRoute.get("/", authorize("ADMIN"), validateGetClients, getClients);
ClientRoute.get(
  "/companies",
  authorize("ADMIN"),
  validateGetClientCompanies,
  getClientCompanies
);
ClientRoute.get(
  "/dashboard/kpi",
  authorize("ADMIN"),
  validateGetClientDashboardKPI,
  getClientDashboardKPI
);
ClientRoute.post(
  "/:id/member",
  authorize("ADMIN"),
  validateCreateClientMember,
  createClientMember
);
ClientRoute.post(
  "/:id/vehicle",
  authorize("ADMIN"),
  validateCreateClientVehicle,
  createClientVehicle
);
ClientRoute.post(
  "/:id/driver",
  authorize("ADMIN"),
  validateCreateClientDriver,
  createClientDriver
);
ClientRoute.post(
  "/:id/service",
  authorize("ADMIN"),
  validateCreateClientService,
  createClientService
);
ClientRoute.post(
  "/:id/document",
  authorize("ADMIN"),
  uploadSingleClientDocument,
  validateAddClientDocument,
  addClientDocument
);
ClientRoute.patch(
  "/member/:id",
  authorize("ADMIN"),
  validateUpdateClientMember,
  updateClientMember
);
ClientRoute.patch(
  "/vehicle/:id",
  authorize("ADMIN"),
  validateUpdateClientVehicle,
  updateClientVehicle
);
ClientRoute.patch(
  "/driver/:id",
  authorize("ADMIN"),
  validateUpdateClientDriver,
  updateClientDriver
);
ClientRoute.patch(
  "/service/:id",
  authorize("ADMIN"),
  validateUpdateClientService,
  updateClientService
);
ClientRoute.delete(
  "/service/:id",
  authorize("ADMIN"),
  validateDeleteClientService,
  deleteClientService
);
ClientRoute.delete(
  "/document/:id",
  authorize("ADMIN"),
  validateDeleteClientDocument,
  deleteDocument
);
ClientRoute.delete(
  "/related",
  authorize("ADMIN"),
  validateDeleteClientRelatedRecord,
  deleteClientRelatedRecord
);
ClientRoute.patch(
  "/:id/company",
  authorize("ADMIN"),
  validateUpdateClientCompanyInformation,
  updateClientCompanyInformation
);
ClientRoute.patch(
  "/:id",
  authorize("ADMIN"),
  validateUpdateClientInformation,
  updateClientInformation
);
ClientRoute.get(
  "/:id",
  authorize("ADMIN"),
  validateGetClientDetails,
  getClientDetails
);

export default ClientRoute;
