import { createLogger, transports } from "winston";

import { createStructuredFormat } from "./structuredFormat.js";

const devLogger = () => {
    return createLogger({
        level: "debug",
        defaultMeta: {
            service: "insurance-crm",
            environment: "development",
        },
        format: createStructuredFormat(),
        transports: [
            new transports.Console() // ONLY PRINTING LOGS IN TERMINAL
        ]
    });
};

export default devLogger;
