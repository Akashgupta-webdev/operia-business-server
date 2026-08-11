export const undeclaredRouteHandler = (req, res, next) => {
    const error = new Error("The requested resource was not found.");
    error.status = 404;
    error.code = "ROUTE_NOT_FOUND";
    return next(error);
};
