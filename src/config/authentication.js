const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

const parsePositiveInteger = (value, fallback, name) => {
  const parsed = Number.parseInt(value ?? String(fallback), 10);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
};

const requireSecret = (value, name) => {
  if (typeof value !== "string" || value.length < 32) {
    throw new Error(`${name} must contain at least 32 characters.`);
  }

  return value;
};

export const getAuthenticationConfig = (environment = process.env) => ({
  accessTokenSecret: requireSecret(
    environment.AUTH_ACCESS_TOKEN_SECRET,
    "AUTH_ACCESS_TOKEN_SECRET"
  ),
  refreshTokenSecret: requireSecret(
    environment.AUTH_REFRESH_TOKEN_SECRET,
    "AUTH_REFRESH_TOKEN_SECRET"
  ),
  accessTokenTtlSeconds: parsePositiveInteger(
    environment.AUTH_ACCESS_TOKEN_TTL_SECONDS,
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    "AUTH_ACCESS_TOKEN_TTL_SECONDS"
  ),
  refreshTokenTtlSeconds: parsePositiveInteger(
    environment.AUTH_REFRESH_TOKEN_TTL_SECONDS,
    DEFAULT_REFRESH_TOKEN_TTL_SECONDS,
    "AUTH_REFRESH_TOKEN_TTL_SECONDS"
  ),
  cookieSecure: environment.NODE_ENV === "production",
  issuer: "insurance-crm",
  audience: "insurance-crm-web",
});

export const validateAuthenticationConfig = () => getAuthenticationConfig();
