import { Router } from "express";

import {
  login,
  refreshToken,
  session,
} from "../controllers/authentication.controller.js";
import { validateLogin } from "../validators/authentication.validator.js";

const authenticationRouter = Router();

authenticationRouter.post("/login", validateLogin, login);
authenticationRouter.post("/refresh-token", refreshToken);
authenticationRouter.get("/session", session);

export default authenticationRouter;
