import { Router } from "express";

import { session } from "../../authentication/controllers/authentication.controller.js";

import { clientLogin, clientRefreshToken, clientSession } from "../../clients/controller/clientAuthentication.controller.js";
import { validateClientLogin } from "../../clients/validators/clientAuthentication.validator.js";

const userRouter = Router();

userRouter.post("/login", validateClientLogin, clientLogin);
userRouter.post("/refresh-token", clientRefreshToken);
userRouter.get("/session", clientSession);

userRouter.get("/me", session);

export default userRouter;
