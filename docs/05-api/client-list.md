# Client List API

This document is the frontend integration contract for searching, filtering,
sorting, and paginating Client summaries.

## Endpoint and Authorization

`GET /api/v1/client`

The endpoint requires an authenticated, active User with the `ADMIN` role.
Authentication uses the existing HTTP-only cookies. There are no path
parameters.

## Request Payload and Documents

This GET endpoint has no request body and does not accept multipart data or
document uploads. It returns only `documentCount`; use the Client creation API
for uploading files and storing Document records.

## Query Parameters

All query parameters are optional. Unknown parameters are rejected.

| Query | Type | Default | Validation and behavior |
| --- | --- | --- | --- |
| `search` | string | none | Trimmed, 1-100 characters; case-insensitive partial match |
| `page` | integer | `1` | Minimum `1` |
| `limit` | integer | `20` | From `1` to `100` |
| `status` | string | none | `Active`, `Inactive`, `Archived`, or `Draft` |
| `clientType` | string | none | `INDIVIDUAL` or `COMPANY` |
| `sort` | string | `Newest First` | One exact value from the sorting table below |

`search` checks these fields with OR behavior:

- Client `name`;
- `emailAddress`;
- `mobileNumber` (the backend equivalent of phone number);
- `whatsappNumber`;
- every related Company's `companyName`.

When `status` and `clientType` are supplied, both filters must match. Search is
then applied within that filtered result.

### Sorting

| Value | Order |
| --- | --- |
| `Newest First` | `createdAt` descending |
| `Oldest First` | `createdAt` ascending |
| `Name(A-Z)` | Client name ascending, case-insensitive |
| `Name(Z-A)` | Client name descending, case-insensitive |

Every sort includes Client `_id` as a deterministic tie-breaker.

## Request Examples

Default first page:

```http
GET /api/v1/client
```

Search company or Client data and apply filters:

```http
GET /api/v1/client?search=example&page=1&limit=20&status=Active&clientType=COMPANY&sort=Name%28A-Z%29
```

Frontend example:

```js
const query = new URLSearchParams({
  search: "example",
  page: "1",
  limit: "20",
  status: "Active",
  clientType: "COMPANY",
  sort: "Name(A-Z)",
});

const response = await fetch(`/api/v1/client?${query}`, {
  method: "GET",
  credentials: "include",
});

const result = await response.json();
```

Do not send empty strings for optional filters. Omit an unused query parameter
instead.

## Success Response

The endpoint returns `200 OK`. `companyName` is the most recently created
related Company's name, or `null` when the Client has no Company. Counts cover
all related records, not only records displayed on the current page.

```json
{
  "data": [
    {
      "_id": "68ad00000000000000000001",
      "name": "Example Person",
      "clientType": "COMPANY",
      "mobileNumber": "+971501234567",
      "emailAddress": "person@example.test",
      "nationality": "India",
      "status": "Active",
      "companyName": "Example Trading LLC",
      "companyCount": 2,
      "serviceCount": 3,
      "documentCount": 4
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

Optional Client fields that have not been recorded are returned as `null`.
Counts are always non-negative integers.

## Pagination Behavior

- `total` is the number of Clients matching search and filters before page
  slicing.
- `totalPages` is `ceil(total / limit)` and is `0` when no Client matches.
- A valid page beyond `totalPages` returns `200 OK` with `data: []`.
- Changing search, status, client type, or limit should reset the frontend to
  page `1`.

Empty result example:

```json
{
  "data": [],
  "page": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

## Validation and Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `422` | `VALIDATION_FAILED` | A query value or query name is invalid |
| `500` | `INTERNAL_ERROR` | The list operation failed unexpectedly |

Example invalid request:

```http
GET /api/v1/client?page=0&limit=101&status=ACTIVE&unknown=value
```

Example error body:

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The client list query is invalid.",
    "details": [
      {
        "field": "page",
        "issue": "\"page\" must be greater than or equal to 1"
      },
      {
        "field": "status",
        "issue": "\"status\" must be one of [Active, Inactive, Archived, Draft]"
      }
    ]
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

The response includes `X-Correlation-Id`. Frontend error reporting should
retain that value so server logs can be correlated with a failed request.
