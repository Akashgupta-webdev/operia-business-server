import User from "../../user/models/user.model.js";
import { AuthenticationError } from "../errors/authentication.error.js";
import {
  hashRefreshToken,
  issueTokenPair,
  refreshTokenMatches,
  verifyAccessToken,
  verifyRefreshToken,
} from "./token.service.js";

const publicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  status: user.status,
  version: user.version,
});

const requireActiveUser = (user) => {
  if (!user || user.status !== "ACTIVE") {
    throw new AuthenticationError("The supplied credentials are invalid.", "INVALID_CREDENTIALS");
  }

  return user;
};

const rotateTokens = async (user, sessionId) => {
  const tokens = issueTokenPair(user, sessionId);
  user.refreshKeyHash = hashRefreshToken(tokens.refreshToken);
  await user.save();

  return { user: publicUser(user), tokens };
};

export const loginWithAccessKey = async (accessKey) => {
  const user = requireActiveUser(
    await User.findOne({ accessKey }).select("+refreshKeyHash").exec()
  );

  return rotateTokens(user);
};

export const refreshAuthentication = async (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken);
  const user = requireActiveUser(
    await User.findById(payload.sub).select("+refreshKeyHash").exec()
  );

  if (!refreshTokenMatches(refreshToken, user.refreshKeyHash)) {
    throw new AuthenticationError("The session is invalid or expired.", "INVALID_SESSION");
  }

  return rotateTokens(user, payload.sid);
};

export const getAuthenticationSession = async ({ accessToken, refreshToken }) => {
  try {
    const payload = verifyAccessToken(accessToken);
    const user = requireActiveUser(await User.findById(payload.sub).exec());
    return { user: publicUser(user), tokens: null };
  } catch (error) {
    if (!(error instanceof AuthenticationError) || !refreshToken) {
      throw error;
    }

    return refreshAuthentication(refreshToken);
  }
};
