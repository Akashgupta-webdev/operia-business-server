import mongoose from "mongoose";

export const systemHealth = (req, res, next) => {
    try {
        const mongoState = mongoose.connection.readyState;
        const connected = mongoState === 1;

        const health = {
            status: connected ? "healthy" : "degraded",
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            database: {
                connected,
            },
        };

        return res.status(connected ? 200 : 503).json({
            data: health,
            meta: { correlationId: req.correlationId },
        });
    } catch (error) {
        return next(error);
    }
};
