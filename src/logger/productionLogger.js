import { createLogger, transports } from "winston";

import { createStructuredFormat } from "./structuredFormat.js";

const productionLogger = () => {
    return createLogger({
        level: "info",
        defaultMeta: {
            service: "insurance-crm",
            environment: "production",
        },
        format: createStructuredFormat(),
        transports: [
            new transports.Console() // ONLY PRINTING LOGS IN TERMINAL
        ]
    });
};

export default productionLogger;
