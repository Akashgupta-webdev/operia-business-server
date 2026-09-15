# Client Portal Credentials

`PATCH /api/v1/client/{id}/credentials` requires an authenticated, active ADMIN.
`id` is the Client's 24-character MongoDB ObjectId.

Supply either or both fields in a JSON body:

```json
{
  "emailAddress": "client@example.com",
  "password": "a-long-portal-password"
}
```

- Email must be valid, at most 254 characters, and is trimmed and lowercased.
- Password must have at least 8 characters and at most 72 UTF-8 bytes. It is
  not trimmed. The service stores the supplied password in plain text.
- Omitted fields remain unchanged. Empty bodies, null values, and unknown fields
  are rejected with `422 VALIDATION_FAILED`.
- Success: `200`, safe Client in `data`, correlation ID in `meta`, version in `ETag`.
- Missing authentication: `401`; non-Admin: `403`; missing Client:
  `404 CLIENT_NOT_FOUND`; unexpected failure: `500 INTERNAL_ERROR`.

The optional `clients.password` field contains the plain-text password, is excluded
from default queries, and is removed from JSON and object serialization.
Generic Client create/update requests continue to reject `password`.

## Schema migration and compatibility

This is an additive optional field: no backfill or database migration command
is needed. Existing records retain an absent password until an Admin sets it.
Do not generate shared default passwords. Email uniqueness rules are unchanged.
This endpoint provisions credentials. Portal login, refresh, and session are
documented in [client-authentication.md](client-authentication.md). The existing
User access-key login remains unchanged.

Per the explicit product request, client passwords are stored in plain text;
anyone with access to this database field can read them. Passwords remain
excluded from API responses and logs. Existing bcrypt hashes cannot be converted
back to passwords; an Admin must set a new password through this endpoint for
any Client whose password was previously hashed. No automatic data rewrite runs.
