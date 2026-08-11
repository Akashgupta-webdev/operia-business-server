import devLogger from "./devLogger.js";
import productionLogger from "./productionLogger.js";

const logger = process.env.NODE_ENV === "production"
    ? productionLogger()
    : devLogger();


export default logger;
