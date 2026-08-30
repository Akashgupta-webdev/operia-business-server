# Client Company List API

## Endpoint

`GET /api/v1/client/companies`

The endpoint requires an authenticated, active `ADMIN`. It returns current
ClientCompany fields together with the owning Client's name, status, and
nationality.

## Request

This `GET` request has no body. All query fields are optional, and unknown
query fields are rejected.

| Query | Default | Validation and behavior |
| --- | --- | --- |
| `page` | `1` | Integer greater than or equal to `1` |
| `limit` | `20` | Integer from `1` through `100` |
| `search` | none | Trimmed string from `1` through `100` characters; case-insensitive partial Company-name match |

```js
const query = new URLSearchParams({
  page: "1",
  limit: "20",
  search: "Example",
});

const response = await fetch(`/api/v1/client/companies?${query}`, {
  method: "GET",
  credentials: "include",
});

const result = await response.json();
```

Companies are sorted by newest `createdAt` first, with `_id` ascending as the
deterministic tie-breaker.

## Success Response

```json
{
  "data": [
    {
      "id": "68ad00000000000000000002",
      "client": "68ad00000000000000000001",
      "companyName": "Example Trading LLC",
      "tradeLicenceNumber": "TL-1001",
      "licenceExpiryDate": "31-12-2027",
      "vatTaxRegistrationNumber": "VAT-1001",
      "corporateTaxNumber": "CT-1001",
      "clientName": "Example Person",
      "clientStatus": "Active",
      "nationality": "India",
      "version": 0,
      "createdAt": "2026-08-30T10:00:00.000Z",
      "updatedAt": "2026-08-30T10:00:00.000Z"
    }
  ],
  "page": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

Missing optional Company or Client values are returned as `null`. An orphaned
Company remains in the result with `clientName`, `clientStatus`, and
`nationality` set to `null`. A page with no matches returns `200` with an empty
`data` array.

There are no enum query fields on this endpoint. Invalid query values return
`422 VALIDATION_FAILED` using the standard error envelope.
