import { Router } from "express";

import { authorize } from "../../../middleware/authorize.middleware.js";
import {
  creatingCompany,
  getCompaniesByClient,
  listCompanies,
} from "../controllers/company.controller.js";
import {
  validateCreateCompany,
  validateGetCompaniesByClient,
  validateListCompaniesQuery,
} from "../validators/company.validator.js";

const companyRouter = Router();

companyRouter.post(
  "/",
  authorize("ADMIN"),
  validateCreateCompany,
  creatingCompany
);
companyRouter.get(
  "/",
  authorize("ADMIN"),
  validateListCompaniesQuery,
  listCompanies
);
companyRouter.get(
  "/client/:clientId",
  authorize("ADMIN"),
  validateGetCompaniesByClient,
  getCompaniesByClient
);

export default companyRouter;
