# Client Portal Credentials

`PATCH /api/v1/client/{id}/credentials` requires an authenticated, active ADMIN.
`id` is the Client's 24-character MongoDB ObjectId.

Supply one or more fields in a JSON body:

```json
{
  "emailAddress": "client@example.com",
  "password": "a-long-portal-password",
  "portalAccess": "Enabled"
}
```

- Email must be valid, at most 254 characters, and is trimmed and lowercased.
- Password must have at least 8 characters and at most 72 UTF-8 bytes. It is
  not trimmed. The service stores the supplied password in plain text.
- Omitted fields remain unchanged. Empty bodies, null values, and unknown fields
  are rejected with `422 VALIDATION_FAILED`.
- Portal access accepts `Enabled` or `Disabled` and defaults to `Disabled`.
  The aliases `Enable` and `Disable` are also accepted and normalized to `Enabled`
  and `Disabled` respectively before storage; responses use the canonical values.
  It may be updated independently. This field does not change authentication behavior.
- Success: `200`, safe Client in `data`, correlation ID in `meta`, version in `ETag`.
- Missing authentication: `401`; non-Admin: `403`; missing Client:
  `404 CLIENT_NOT_FOUND`; unexpected failure: `500 INTERNAL_ERROR`.

The optional `clients.password` field contains the plain-text password, is excluded
from default queries, and is removed from JSON and object serialization.
Generic Client create/update requests continue to reject `password`.

## Schema migration and compatibility

This is an additive optional field: no backfill or database migration command
is needed. Existing records retain an absent password until an Admin sets it.
Existing records without portalAccess receive the Mongoose default `Disabled` when loaded.
Do not generate shared default passwords. Email uniqueness rules are unchanged.
This endpoint provisions credentials. Portal login, refresh, and session are
documented in [client-authentication.md](client-authentication.md). The existing
User access-key login remains unchanged.

Per the explicit product request, client passwords are stored in plain text;
anyone with access to this database field can read them. Passwords remain
excluded from logs and API responses except the Admin client-detail response.
Existing bcrypt hashes cannot be converted
back to passwords; an Admin must set a new password through this endpoint for
any Client whose password was previously hashed. No automatic data rewrite runs.
