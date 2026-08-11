import { config } from 'dotenv'
config();

import mongoose from "mongoose";

import app from "./app.js";
import { validateAuthenticationConfig } from "./config/authentication.js";
import connectDb from "./config/database.js";
import logger from "./logger/index.js";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const start = async () => {
  try {
    validateAuthenticationConfig();
    await connectDb();
  } catch {
    logger.error("Application startup aborted during configuration or database setup.");
    process.exitCode = 1;
    return;
  }

  const server = app.listen(port, () => {
    logger.info("Insurance CRM API started.", { port });
  });

  const shutdown = async (signal) => {
    logger.info("Application shutdown requested.", { signal });
    server.close(async (error) => {
      if (error) {
        logger.error("HTTP server shutdown failed.", { errorName: error.name });
        process.exitCode = 1;
      }

      await mongoose.disconnect();
    });
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
};

await start();
