import logger from "../../../logger/index.js";
import { setAuthenticationCookies } from "../../authentication/controllers/authentication.controller.js";
import { getClientAuthenticationSession, loginClientWithPassword, refreshClientAuthentication } from "../services/clientAuthentication.service.js";

const CLIENT_COOKIES = Object.freeze({ access: "clientAccessToken", refresh: "clientRefreshToken" });

// Writes isolated Client cookies and the standard safe session response envelope.
// Reuses the staff cookie policy so production and development flags remain consistent.
const sendClientSession = (req, res, result) => {
  if (result.tokens) setAuthenticationCookies(res, result.tokens, CLIENT_COOKIES);
  res.set("Cache-Control", "no-store");
  return res.status(200).json({ data: result.client, meta: { correlationId: req.correlationId } });
};

// Logs only operation metadata for authentication failures, including terminal visibility.
// Raw database errors, request values, and tokens must not reach logs.
const logClientAuthenticationError = (operation, error, correlationId) => {
  const context = { operation, errorName: error.name, errorCode: error.code, correlationId };
  console.error("Client authentication failed.", context);
  logger.error("Client authentication failed.", context);
};

// Authenticates Client email and password and issues a fresh portal session.
// Validation runs before this controller and persistence stays in the Client service.
export const clientLogin = async (req, res, next) => {
  try {
    const result = await loginClientWithPassword(req.validatedBody);
    logger.info("Client authentication succeeded.", { clientId: result.client.id, correlationId: req.correlationId });
    return sendClientSession(req, res, result);
  } catch (error) {
    logClientAuthenticationError("login", error, req.correlationId);
    return next(error);
  }
};

// Rotates the Client refresh cookie and replaces both portal authentication cookies.
// Replay and missing-cookie failures use the shared authentication error contract.
export const clientRefreshToken = async (req, res, next) => {
  try {
    const result = await refreshClientAuthentication(req.cookies?.[CLIENT_COOKIES.refresh]);
    return sendClientSession(req, res, result);
  } catch (error) {
    logClientAuthenticationError("refresh", error, req.correlationId);
    return next(error);
  }
};

// Retrieves the active Client session, automatically refreshing expired access credentials.
// The existing staff /me endpoint keeps its own authentication flow and cookies.
export const clientSession = async (req, res, next) => {
  try {
    const result = await getClientAuthenticationSession({
      accessToken: req.cookies?.[CLIENT_COOKIES.access],
      refreshToken: req.cookies?.[CLIENT_COOKIES.refresh],
    });
    return sendClientSession(req, res, result);
  } catch (error) {
    logClientAuthenticationError("session", error, req.correlationId);
    return next(error);
  }
};
