const errorCodeByStatus = {
    400: "MALFORMED_REQUEST",
    401: "AUTHENTICATION_REQUIRED",
    403: "FORBIDDEN",
    404: "RESOURCE_NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_FAILED",
    429: "RATE_LIMIT_EXCEEDED",
};

const isSafeStatus = (status) =>
    Number.isInteger(status) && status >= 400 && status <= 599;

const isSafeCode = (code) =>
    typeof code === "string" && /^[A-Z][A-Z0-9_]*$/.test(code);

const ErrorHandler = (error, req, res, _next) => {
    const requestedStatus = error.status ?? error.statusCode;
    const status = isSafeStatus(requestedStatus) ? requestedStatus : 500;
    const isUnexpected = status >= 500;
    const code = isSafeCode(error.code)
        ? error.code
        : errorCodeByStatus[status] ?? "INTERNAL_ERROR";
    const message = isUnexpected
        ? "An unexpected error occurred."
        : error.message || "The request could not be completed.";

    return res.status(status).json({
        error: {
            code,
            message,
            details: Array.isArray(error.details) ? error.details : [],
        },
        meta: { correlationId: req.correlationId },
    });
};

export default ErrorHandler;
