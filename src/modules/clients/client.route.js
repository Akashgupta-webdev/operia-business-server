import express from "express";
import { createFilingWriteHandler } from "./controller/clientFilingWrite.controller.js";
import { validateFilingWrite } from "./validators/clientFilingBody.validator.js";
import { getClientVATFilings, getClientTAXFilings } from "./controller/clientFiling.controller.js";
import { validateClientFilingQuery } from "./validators/clientFilingQuery.validator.js";
import {
  getClientInformationForCompliance,
  getClientForAddingInComplianceService,
  getClientAddedInComplianceService,
  AddClientInComplianceService,
  RemoveClientFromComplianceService,
} from "./controller/clientCompliance.controller.js";
import { validateClientCompliance } from "./validators/clientCompliance.validator.js";
import { updateClientCredentials } from "./controller/clientCredentials.controller.js";
import { validateUpdateClientCredentials } from "./validators/clientCredentials.validator.js";

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
  updateNextVATorTAXDueDate,
} from "./controller/clientCompany.controller.js";
import { getClientDashboardKPI } from "./controller/clientDashboard.controller.js";
import {
  addClientDocument,
  deleteDocument,
  getClientDocuments,
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
import { validateUpdateClientCompanyInformation, validateUpdateNextVATorTAXDueDate } from "./validators/clientCompanyBody.validator.js";
import { validateGetClientCompanies } from "./validators/clientCompanyQuery.validator.js";
import { validateGetClientDashboardKPI } from "./validators/clientDashboard.validator.js";
import {
  validateAddClientDocument,
  validateDeleteClientDocument,
} from "./validators/clientDocument.validator.js";
import { validateGetClientDetails } from "./validators/clientParams.validator.js";
import { validateGetClients } from "./validators/clientQuery.validator.js";
import { validateGetClientDocuments } from "./validators/clientDocumentQuery.validator.js";
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

import { getClientRenewals } from "./controller/clientRenewal.controller.js";
import { validateGetClientRenewals } from "./validators/clientRenewal.validator.js";

import { handleVatRequest } from "./controller/clientVat.controller.js";
import { validateVatRequest, vatActionSchemas } from "./validators/clientVat.validator.js";

const ClientRoute = express.Router();

for (const type of ["VAT", "TAX"]) {
  ClientRoute.post(`/createFiling${type}/:companyId`, authorize("ADMIN"), validateFilingWrite("create"), createFilingWriteHandler(type, "create"));
  ClientRoute.patch(`/updateFiling${type}/:id`, authorize("ADMIN"), validateFilingWrite("update"), createFilingWriteHandler(type, "update"));
  ClientRoute.delete(`/deleteFiling${type}/:id`, authorize("ADMIN"), validateFilingWrite("delete"), createFilingWriteHandler(type, "delete"));
}

ClientRoute.patch(
  "/updateNextVATorTAXDueDate/:companyId",
  authorize("ADMIN"),
  validateUpdateNextVATorTAXDueDate,
  updateNextVATorTAXDueDate
);

ClientRoute.get("/:id/vat-filings", authorize("ADMIN"), validateGetClientDetails, validateClientFilingQuery, getClientVATFilings);
ClientRoute.get("/:id/tax-filings", authorize("ADMIN"), validateGetClientDetails, validateClientFilingQuery, getClientTAXFilings);

ClientRoute.get("/:id/compliance", authorize("ADMIN"), validateGetClientDetails, getClientInformationForCompliance);

ClientRoute.get("/compliance/eligible-clients", authorize("ADMIN"), validateClientCompliance("query"), getClientForAddingInComplianceService);
ClientRoute.get("/compliance/clients", authorize("ADMIN"), validateClientCompliance("query"), getClientAddedInComplianceService);
ClientRoute.patch("/compliance/enrollment", authorize("ADMIN"), validateClientCompliance("body"), AddClientInComplianceService);
ClientRoute.patch("/compliance/withdrawal", authorize("ADMIN"), validateClientCompliance("body"), RemoveClientFromComplianceService);

ClientRoute.get("/services", authorize("ADMIN"), validateVatRequest("list"), handleVatRequest("list"));
ClientRoute.get("/service/:id", authorize("ADMIN"), validateVatRequest("detail"), handleVatRequest("detail"));
for (const action of Object.keys(vatActionSchemas)) {
  ClientRoute.post(`/service/:id/vat/${action}`, authorize("ADMIN"), validateVatRequest(action), handleVatRequest(action));
}

ClientRoute.patch(
  "/:id/credentials",
  authorize("ADMIN"),
  validateUpdateClientCredentials,
  updateClientCredentials
);

ClientRoute.get(
  "/renewals",
  authorize("ADMIN"),
  validateGetClientRenewals,
  getClientRenewals
);

ClientRoute.post(
  "/",
  authorize("ADMIN"),
  uploadClientServiceDocuments,
  validateCreateClient,
  createClient
);

ClientRoute.get("/", authorize("ADMIN"), validateGetClients, getClients);
ClientRoute.get(
  "/documents",
  authorize("ADMIN"),
  validateGetClientDocuments,
  getClientDocuments
);
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
