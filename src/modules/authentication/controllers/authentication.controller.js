import { getAuthenticationConfig } from "../../../config/authentication.js";
import logger from "../../../logger/index.js";
import { hashAccessKey } from "../../user/models/user.model.js";
import {
  getAuthenticationSession,
  loginWithAccessKey,
  refreshAuthentication,
} from "../services/authentication.service.js";

const ACCESS_COOKIE = "accessToken";
const REFRESH_COOKIE = "refreshToken";

const cookieOptions = (maxAge, config) => ({
  httpOnly: true,
  secure: config.cookieSecure,
  sameSite: "none",
  path: "/",
  maxAge,
});

export const setAuthenticationCookies = (res, tokens) => {
  const config = getAuthenticationConfig();
  res.cookie(
    ACCESS_COOKIE,
    tokens.accessToken,
    cookieOptions(config.accessTokenTtlSeconds * 1000, config)
  );
  res.cookie(
    REFRESH_COOKIE,
    tokens.refreshToken,
    cookieOptions(config.refreshTokenTtlSeconds * 1000, config)
  );
};

const sendSession = (req, res, result) => {
  if (result.tokens) {
    setAuthenticationCookies(res, result.tokens);
  }

  res.set("Cache-Control", "no-store");
  return res.status(200).json({
    data: result.user,
    meta: { correlationId: req.correlationId },
  });
};

const logAuthenticationError = (operation, error, correlationId) => {
  logger.error(`Authentication ${operation} failed.`, {
    errorName: error.name,
    errorMessage: error.message,
    errorCode: error.code,
    stack: error.stack,
    correlationId,
  });
};

export const login = async (req, res, next) => {
  try {
    const accessKeyHash = hashAccessKey(req.body.accessKey);
    const result = await loginWithAccessKey(accessKeyHash);
    setAuthenticationCookies(res, result.tokens);
    logger.info("Authentication succeeded.", {
      userId: result.user.id,
      correlationId: req.correlationId,
    });
    return sendSession(req, res, { ...result, tokens: null });
  } catch (error) {
    logAuthenticationError("login", error, req.correlationId);
    return next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    const result = await refreshAuthentication(req.cookies[REFRESH_COOKIE]);
    return sendSession(req, res, result);
  } catch (error) {
    logAuthenticationError("refresh", error, req.correlationId);
    return next(error);
  }
};

export const session = async (req, res, next) => {
  try {
    const result = await getAuthenticationSession({
      accessToken: req.cookies[ACCESS_COOKIE],
      refreshToken: req.cookies[REFRESH_COOKIE],
    });
    return sendSession(req, res, result);
  } catch (error) {
    logAuthenticationError("session lookup", error, req.correlationId);
    return next(error);
  }
};
