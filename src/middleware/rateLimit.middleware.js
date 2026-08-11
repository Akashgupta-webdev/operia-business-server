import rateLimit from "express-rate-limit";

const rateLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  limit: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "Too many requests. Please try again later.",
        details: [],
      },
      meta: { correlationId: req.correlationId },
    });
  },
});

export default rateLimiter;
