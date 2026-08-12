import { Router } from "express";

import { authorize } from "../../../middleware/authorize.middleware.js";
import {
  creatingCompany,
  getCompaniesByClient,
} from "../controllers/company.controller.js";
import {
  validateCreateCompany,
  validateGetCompaniesByClient,
} from "../validators/company.validator.js";

const companyRouter = Router();

companyRouter.post(
  "/",
  authorize("ADMIN"),
  validateCreateCompany,
  creatingCompany
);
companyRouter.get(
  "/client/:clientId",
  authorize("ADMIN"),
  validateGetCompaniesByClient,
  getCompaniesByClient
);

export default companyRouter;
