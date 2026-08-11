import logger from "../logger/index.js";
import { setAuthenticationCookies } from "../modules/authentication/controllers/authentication.controller.js";
import { AuthenticationError } from "../modules/authentication/errors/authentication.error.js";
import { getAuthenticationSession } from "../modules/authentication/services/authentication.service.js";

class AuthorizationError extends Error {
  constructor() {
    super("You are not authorized to perform this action.");
    this.name = "AuthorizationError";
    this.status = 403;
    this.code = "FORBIDDEN";
  }
}

export const authorize = (...allowedRoles) => {
  const allowedRoleSet = new Set(allowedRoles);

  return async (req, res, next) => {
    try {
      const result = await getAuthenticationSession({
        accessToken: req.cookies.accessToken,
        refreshToken: req.cookies.refreshToken,
      });

      if (result.tokens) {
        setAuthenticationCookies(res, result.tokens);
      }

      req.user = result.user;

      if (!allowedRoleSet.has(req.user.role)) {
        logger.warn("Authorization denied.", {
          userId: req.user.id,
          userRole: req.user.role,
          correlationId: req.correlationId,
        });
        throw new AuthorizationError();
      }

      return next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn("Authentication required for protected route.", {
          errorCode: error.code,
          correlationId: req.correlationId,
        });
      }

      return next(error);
    }
  };
};
