import { randomUUID } from "node:crypto";

import { runWithRequestContext } from "../logger/requestContext.js";

export const CORRELATION_ID_HEADER = "X-Correlation-Id";

const CORRELATION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export const isValidCorrelationId = (value) =>
    typeof value === "string" && CORRELATION_ID_PATTERN.test(value.trim());

const requestContext = (req, res, next) => {
    const receivedCorrelationId = req.get(CORRELATION_ID_HEADER);
    const correlationId = isValidCorrelationId(receivedCorrelationId)
        ? receivedCorrelationId.trim()
        : randomUUID();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    return runWithRequestContext(
        {
            correlationId,
            method: req.method,
            path: req.originalUrl,
        },
        next
    );
};

export default requestContext;
