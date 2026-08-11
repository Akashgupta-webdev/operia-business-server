import { format } from "winston";

import { getRequestContext } from "./requestContext.js";

const requestContextFormat = format((info) => {
    const context = getRequestContext();

    for (const [key, value] of Object.entries(context)) {
        if (value !== undefined) {
            info[key] = value;
        }
    }

    return info;
});

export const createStructuredFormat = () =>
    format.combine(
        format.errors({ stack: true }),
        format.splat(),
        requestContextFormat(),
        format.timestamp(),
        format.json()
    );
