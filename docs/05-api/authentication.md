# Release 1 Authentication API

## 1. Endpoints

| Method and path | Action |
| --- | --- |
| `POST /api/v1/auth/login` | Authenticate with a generated access key |
| `POST /api/v1/auth/refresh-token` | Rotate the refresh token and issue fresh cookies |
| `GET /api/v1/auth/session` | Return the active User and automatically refresh expired access credentials |

## 2. Login

The request contains only the high-entropy key originally issued to the User:

```json
{
  "accessKey": "A1b2C3d4E5f6"
}
```

The access key must contain exactly 12 characters. The authentication
controller hashes it before querying the stored User credential digest.

Successful authentication sets `accessToken` and `refreshToken` as `HttpOnly`,
`SameSite=Strict` cookies. Production cookies are also `Secure`. Token values
are not returned in JSON. The response contains the safe User representation.

## 3. Refresh and Session

Refresh-token accepts the refresh cookie, rotates it, persists only the new
token digest, and replaces both cookies. A refresh token can therefore be used
only once. One User has one current refresh session; logging in again revokes
the prior refresh session.

Session first validates the access cookie. If it is missing or expired and a
valid refresh cookie exists, session performs the same rotation automatically.
Inactive Users cannot log in, refresh, or retrieve a session.

## 4. Configuration

`AUTH_ACCESS_TOKEN_SECRET` and `AUTH_REFRESH_TOKEN_SECRET` are required and must
each contain at least 32 characters. `AUTH_ACCESS_TOKEN_TTL_SECONDS` defaults to
900 seconds, and `AUTH_REFRESH_TOKEN_TTL_SECONDS` defaults to 604800 seconds.

## 5. Errors

Authentication failures use `401` with `INVALID_CREDENTIALS`,
`AUTHENTICATION_REQUIRED`, `REFRESH_TOKEN_REQUIRED`, or `INVALID_SESSION`.
Malformed login input uses `422 VALIDATION_FAILED`. Responses never reveal
whether a particular User or credential exists.
