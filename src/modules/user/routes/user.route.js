import { Router } from "express";

import { session } from "../../authentication/controllers/authentication.controller.js";

const userRouter = Router();

userRouter.get("/me", session);

export default userRouter;
