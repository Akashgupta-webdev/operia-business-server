# Client Authentication API

These routes are registered in `user.route.js`, mounted at `/api/v1`.

| Method and path | Action |
| --- | --- |
| `POST /api/v1/login` | Authenticate Client email and password |
| `POST /api/v1/refresh-token` | Rotate Client refresh token and replace cookies |
| `GET /api/v1/session` | Return Client session, automatically refreshing when needed |

## Login

```json
{ "emailAddress": "client@example.com", "password": "client-password" }
```

Both fields are required. Email is trimmed, lowercased, validated, and limited
 to 254 characters. Password is not trimmed and requires at least 8 characters
and at most 72 UTF-8 bytes. Unknown fields are rejected. The password is compared
against the existing plain-text Client password, as explicitly requested.
Only `Active` Clients can authenticate. Missing accounts, wrong passwords,
inactive accounts, and duplicate email matches return non-disclosing errors.
Admins must resolve duplicate emails before those Clients can log in.

## Cookies and response

Send requests with `credentials: "include"`. Cookies are named
`clientAccessToken` and `clientRefreshToken`, use `HttpOnly`, and have path `/`.
Development uses `SameSite=Strict`; production uses `SameSite=None; Secure`.
Staff authentication continues using `accessToken` and `refreshToken`.
Client JWTs use audience `insurance-crm-client`, preventing their use in staff
APIs even if submitted under staff cookie names. Existing AUTH configuration
provides secrets and token lifetimes (defaults: 15 minutes access, 7 days refresh).

All three endpoints return `200`, `Cache-Control: no-store`, and:

```json
{
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "Example Client",
    "emailAddress": "client@example.com",
    "role": "CLIENT",
    "status": "Active",
    "version": 1
  },
  "meta": { "correlationId": "request-correlation-id" }
}
```

Passwords and tokens are never returned in JSON. Refresh consumes the previous
refresh digest atomically; replay and simultaneous reuse are rejected. Logging
in again replaces the prior refresh session. As with staff sessions, already
issued access tokens remain usable until expiry while the account is Active.
Session uses a valid access token first, otherwise attempts refresh if supplied.
`GET /api/v1/me` remains the staff session endpoint.

## Errors

- `422 VALIDATION_FAILED`: invalid login body.
- `401 INVALID_CREDENTIALS`: login rejected or inactive/missing session Client.
- `401 AUTHENTICATION_REQUIRED`: no access or refresh cookie for session.
- `401 REFRESH_TOKEN_REQUIRED`: refresh called without its cookie.
- `401 INVALID_SESSION`: invalid/expired token, refresh replay, inactive refresh
  target, or a concurrent update preventing login token persistence.
- `500 INTERNAL_ERROR`: unexpected error.

## Additive schema migration

`clients.refreshKeyHash` is an optional, private string containing the SHA-256
refresh-token digest. No backfill is required: existing Clients have no refresh
session until successful login. The field is excluded from default queries,
JSON, and object serialization. Client passwords remain unchanged.
