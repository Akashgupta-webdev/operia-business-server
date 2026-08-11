# Client API

## 1. Scope

This API supports direct creation of Client records by an authenticated Admin.
Lead conversion, duplicate matching, history migration, and links to Policies
or other deferred modules are not part of this endpoint.

## 2. Create Client

`POST /api/v1/clients`

Only an active User with the `ADMIN` role may call this endpoint.

The JSON request accepts:

| Field | Requirement |
| --- | --- |
| `name` | Required; 2 to 200 characters |
| `mobileNumber` | Optional; at least one contact field is required |
| `whatsappNumber` | Optional; at least one contact field is required |
| `emailAddress` | Optional valid email; at least one contact field is required |
| `nationality` | Optional; maximum 120 characters |
| `emiratesIdNumber` | Optional; maximum 30 characters |
| `passportNumber` | Optional; maximum 30 characters |
| `address` | Optional; maximum 500 characters |
| `preferredCommunicationMethod` | Required: `EMAIL`, `WHATSAPP`, or `CALL` |
| `notes` | Optional; maximum 5,000 characters |
| `clientStatus` | Optional: `ACTIVE`, `INACTIVE`, `PROSPECT`, or `ARCHIVED`; defaults to `ACTIVE` |

Unknown request fields are rejected. The Client type defaults to
`INDIVIDUAL` because this create contract does not currently expose
`clientType`.

Successful creation returns `201 Created`, a standard single-resource
response envelope, a `Location` header, and a version `ETag`.

## 3. Get Client Summary

`GET /api/v1/clients/{clientId}`

Only an active User with the `ADMIN` role may call this endpoint. The
response returns only:

- `clientId`
- `name`
- `emiratesIdNumber`
- `emailAddress`
- `mobileNumber`
- `whatsappNumber`
- `clientStatus`

Optional values that are not recorded are returned as `null`. An unknown
Client identifier returns `404 CLIENT_NOT_FOUND`.

## 4. List Clients

`GET /api/v1/clients?page={page}&limit={limit}&search={search}`

Only an active User with the `ADMIN` role may call this endpoint.

| Query | Requirement |
| --- | --- |
| `page` | Optional positive integer; defaults to `1` |
| `limit` | Optional integer from `1` to `100`; defaults to `25` |
| `search` | Optional trimmed string from 1 to 100 characters |

Search is case-insensitive and matches Client name, Emirates ID number, email
address, mobile number, or WhatsApp number. Results are sorted by newest
creation time first with `clientId` as the deterministic tie-breaker.

Each result uses the same fields as the Client summary endpoint. The response
contains:

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

An empty result returns `200` with an empty `data` array.

## 5. Errors

- `401 AUTHENTICATION_REQUIRED` when no valid session is available.
- `403 FORBIDDEN` when the authenticated User is not an Admin.
- `422 VALIDATION_FAILED` when the request does not satisfy the field rules.
- `404 CLIENT_NOT_FOUND` when the requested Client does not exist.
- `500 INTERNAL_ERROR` for an unexpected persistence failure.
