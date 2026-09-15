import { getAuthenticationConfig } from "../../../config/authentication.js";
import { AuthenticationError, ValidationError } from "../../authentication/errors/authentication.error.js";
import { hashRefreshToken, issueTokenPair, verifyAccessToken, verifyRefreshToken } from "../../authentication/services/token.service.js";
import Client from "../models/client.model.js";
import { clientLoginSchema } from "../validators/clientAuthentication.validator.js";

// Separates Client JWTs from staff JWTs while reusing configured secrets and lifetimes.
// Both token issuance and verification must use this audience to prevent identity confusion.
export const getClientAuthenticationConfig = () => ({
  ...getAuthenticationConfig(),
  audience: "insurance-crm-client",
});

// Builds the minimal Client session response from an explicit field allow-list.
// Passwords and refresh-token digests never enter an authentication response.
const publicClient = (client) => ({
  id: client._id.toString(),
  name: client.name,
  emailAddress: client.emailAddress,
  role: "CLIENT",
  status: client.status,
  version: client.version,
});

// Rejects missing and inactive Clients with the same non-disclosing credentials error.
// Client status uses the existing title-case Active value rather than the staff enum.
const requireActiveClient = (client) => {
  if (!client || client.status !== "Active") {
    throw new AuthenticationError("The supplied credentials are invalid.", "INVALID_CREDENTIALS");
  }
  return client;
};

// Persists a new token digest with a conditional atomic update before returning cookies.
// The caller's condition prevents refresh replay and stale login writes during credential changes.
const rotateClientTokens = async (clientId, condition, sessionId) => {
  const tokens = issueTokenPair({ id: clientId.toString(), role: "CLIENT" }, sessionId, getClientAuthenticationConfig());
  const client = await Client.findOneAndUpdate(
    { _id: clientId, status: "Active", ...condition },
    { $set: { refreshKeyHash: hashRefreshToken(tokens.refreshToken) }, $inc: { version: 1 } },
    { returnDocument: "after", runValidators: true }
  ).exec();
  if (!client) {
    throw new AuthenticationError("The session is invalid or expired.", "INVALID_SESSION");
  }
  return { client: publicClient(client), tokens };
};

// Authenticates the normalized email against the explicitly requested plain-text password storage.
// Ambiguous email matches are rejected rather than choosing an arbitrary Client account.
export const loginClientWithPassword = async (credentials) => {
  const { error, value } = clientLoginSchema.validate(credentials);
  if (error) {
    throw new ValidationError([{ field: "credentials", issue: "Invalid client login request." }]);
  }
  const matches = await Client.find({ emailAddress: value.emailAddress }).select("+password").limit(2).exec();
  const client = requireActiveClient(matches.length === 1 ? matches[0] : null);
  if (typeof client.password !== "string" || client.password !== value.password) {
    throw new AuthenticationError("The supplied credentials are invalid.", "INVALID_CREDENTIALS");
  }
  return rotateClientTokens(client._id, { version: client.version ?? { $exists: false } });
};

// Verifies a Client refresh JWT and consumes its persisted digest exactly once.
// Concurrent refresh attempts compete on the digest in one atomic database update.
export const refreshClientAuthentication = async (refreshToken) => {
  const payload = verifyRefreshToken(refreshToken, getClientAuthenticationConfig());
  return rotateClientTokens(payload.sub, { refreshKeyHash: hashRefreshToken(refreshToken) }, payload.sid);
};

// Returns the active Client from a valid access cookie or automatically rotates a refresh cookie.
// Staff tokens fail audience verification and can never select a Client identity.
export const getClientAuthenticationSession = async ({ accessToken, refreshToken }) => {
  try {
    const payload = verifyAccessToken(accessToken, getClientAuthenticationConfig());
    const client = requireActiveClient(await Client.findById(payload.sub).exec());
    return { client: publicClient(client), tokens: null };
  } catch (error) {
    if (!(error instanceof AuthenticationError) || !refreshToken) throw error;
    return refreshClientAuthentication(refreshToken);
  }
};
