# Company API

## 1. Create Company

`POST /api/v1/companies`

Only an active User with the `ADMIN` role may call this endpoint. The referenced
Client must exist. The JSON request requires:

| Field | Requirement |
| --- | --- |
| `client` | Required 24-character hexadecimal Client MongoDB `_id` |
| `companyName` | Required; 2 to 200 characters |
| `companyType` | Required: `MAINLAND`, `FREE_ZONE`, or `OFFSHORE` |

The request may also contain the documented Company fields: `tradeName`,
`legalName`, `freeZoneName`, `licence`, `establishment`, tax identifiers,
contact fields, bank fields, `companyStatus`, and an array of `notes`. Unknown
fields are rejected. The server generates `companyId`, and `companyStatus`
defaults to `ACTIVE`.

Successful creation returns `201 Created`, a standard single-resource response
envelope, a `Location` header, and a version `ETag`.

## 2. Get Companies by Client

`GET /api/v1/companies/client/{clientId}?page={page}&limit={limit}`

Only an active User with the `ADMIN` role may call this endpoint. `clientId` is
the Client record's 24-character hexadecimal MongoDB `_id`, not its public
`clientId` field.

| Query | Requirement |
| --- | --- |
| `page` | Optional positive integer; defaults to `1` |
| `limit` | Optional integer from `1` to `100`; defaults to `25` |

Companies are sorted by newest creation time first, with `companyId` as the
deterministic tie-breaker. The response contains full Company representations:

```json
{
  "data": [],
  "page": {
    "page": 1,
    "limit": 25,
    "total": 0,
    "totalPages": 0
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

An existing Client with no Companies returns `200` and an empty `data` array.
An unknown Client returns `404 CLIENT_NOT_FOUND`.

## 3. Errors

- `401 AUTHENTICATION_REQUIRED` when no valid session is available.
- `403 FORBIDDEN` when the authenticated User is not an Admin.
- `404 CLIENT_NOT_FOUND` when the referenced Client does not exist.
- `422 VALIDATION_FAILED` when the request does not satisfy the field rules.
- `500 INTERNAL_ERROR` for an unexpected persistence failure.
