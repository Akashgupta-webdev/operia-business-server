import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import jwt from "jsonwebtoken";

import { getAuthenticationConfig } from "../../../config/authentication.js";
import { AuthenticationError } from "../errors/authentication.error.js";

const TOKEN_ALGORITHM = "HS256";

export const hashRefreshToken = (token) =>
  createHash("sha256").update(token).digest("hex");

export const refreshTokenMatches = (token, expectedHash) => {
  if (!token || !expectedHash) {
    return false;
  }

  const actual = Buffer.from(hashRefreshToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export const issueTokenPair = (
  user,
  sessionId = randomUUID(),
  config = getAuthenticationConfig()
) => {
  const commonOptions = {
    algorithm: TOKEN_ALGORITHM,
    issuer: config.issuer,
    audience: config.audience,
    subject: user.id ?? user._id.toString(),
  };

  return {
    accessToken: jwt.sign(
      { type: "access", role: user.role, sid: sessionId },
      config.accessTokenSecret,
      { ...commonOptions, expiresIn: config.accessTokenTtlSeconds }
    ),
    refreshToken: jwt.sign(
      { type: "refresh", sid: sessionId },
      config.refreshTokenSecret,
      {
        ...commonOptions,
        expiresIn: config.refreshTokenTtlSeconds,
        jwtid: randomUUID(),
      }
    ),
  };
};

const verifyToken = (token, secret, expectedType, config) => {
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: [TOKEN_ALGORITHM],
      issuer: config.issuer,
      audience: config.audience,
    });

    if (payload.type !== expectedType || typeof payload.sub !== "string") {
      throw new Error("Unexpected token payload.");
    }

    return payload;
  } catch {
    throw new AuthenticationError("The session is invalid or expired.", "INVALID_SESSION");
  }
};

export const verifyAccessToken = (token, config) => {
  if (!token) {
    throw new AuthenticationError();
  }

  const resolvedConfig = config ?? getAuthenticationConfig();
  return verifyToken(
    token,
    resolvedConfig.accessTokenSecret,
    "access",
    resolvedConfig
  );
};

export const verifyRefreshToken = (token, config) => {
  if (!token) {
    throw new AuthenticationError("A refresh token is required.", "REFRESH_TOKEN_REQUIRED");
  }

  const resolvedConfig = config ?? getAuthenticationConfig();
  return verifyToken(
    token,
    resolvedConfig.refreshTokenSecret,
    "refresh",
    resolvedConfig
  );
};
