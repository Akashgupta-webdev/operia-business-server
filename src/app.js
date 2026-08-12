import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import ErrorHandler from "./middleware/errorHandler.middleware.js";
import rateLimiter from "./middleware/rateLimit.middleware.js";
import requestContext from "./middleware/requestContext.middleware.js";
import authenticationRouter from "./modules/authentication/routes/authentication.routes.js";
import clientRouter from "./modules/clients/routes/client.route.js";
import companyRouter from "./modules/company/routes/company.route.js";
import userRouter from "./modules/user/routes/user.route.js";
import { systemHealth } from "./utils/systemHealth.js";
import { undeclaredRouteHandler } from "./utils/undeclaredRoute.js";
import { config } from 'dotenv'
config();

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(requestContext);
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
console.log(process.env.ALLOWED_ORIGIN)
const allowedOrigins = [
  process.env.ALLOWED_ORIGIN
];
console.log(allowedOrigins)

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Authorization",
      "Content-Type",
      "Accept-Language",
      "Cookie",
      "X-Correlation-Id",
      "Idempotency-Key",
      "If-Match",
    ],
    exposedHeaders: ["X-Correlation-Id", "ETag"],
  })
);

app.use(rateLimiter);
app.get("/health", systemHealth);
app.use("/api/v1/auth", authenticationRouter);
app.use("/api/v1/clients", clientRouter);
app.use("/api/v1/companies", companyRouter);
app.use("/api/v1", userRouter);

// Feature routes are registered above the fallback handler.
app.use(undeclaredRouteHandler);
app.use(ErrorHandler);

export default app;
