import mongoose from "mongoose";
import logger from "../logger/index.js";

const connectDb = async () => {
    if (!process.env.MONGODB_URI) {
        throw new Error("MONGODB_URI is required.");
    }

    try {
        const db = await mongoose.connect(process.env.MONGODB_URI);
        logger.info("MongoDB database connected successfully.");
        return db;
    } catch (error) {
        logger.error("MongoDB database connection failed.", {
            errorName: error.name,
            errorCode: error.code,
            errorMessage: error.message,
            errorCause: error.cause?.message,
        });
        throw new Error("Database connection failed.", { cause: error });
    }
};


export default connectDb;
