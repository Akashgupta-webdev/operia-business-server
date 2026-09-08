import express from "express";

import { authorize } from "../../middleware/authorize.middleware.js";
import { createExpense } from "./controller/expense.controller.js";
import { getProfitLoss } from "./controller/profitLoss.controller.js";
import { getRevenueInflow } from "./controller/revenueInflow.controller.js";
import { validateCreateExpense } from "./validators/expense.validator.js";
import { validateGetProfitLoss } from "./validators/profitLoss.validator.js";
import { validateGetRevenueInflow } from "./validators/revenueInflow.validator.js";

const ProfitLossRoute = express.Router();

ProfitLossRoute.get(
  "/",
  authorize("ADMIN"),
  validateGetProfitLoss,
  getProfitLoss
);

ProfitLossRoute.post(
  "/expense",
  authorize("ADMIN"),
  validateCreateExpense,
  createExpense
);

ProfitLossRoute.get(
  "/revenue-inflow",
  authorize("ADMIN"),
  validateGetRevenueInflow,
  getRevenueInflow
);

export default ProfitLossRoute;
