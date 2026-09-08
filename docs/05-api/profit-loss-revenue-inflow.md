# Revenue Inflow List API

## Endpoint

`GET /api/v1/profit-loss/revenue-inflow`

The endpoint requires an authenticated, active `ADMIN`. It returns Client
Service revenue records together with the owning Client name.

## Query

| Field | Default | Validation |
| --- | --- | --- |
| `page` | `1` | Integer greater than or equal to `1` |
| `limit` | `20` | Integer from `1` through `100` |

Unknown query parameters are rejected. Records are sorted by newest
`createdAt` first, with `_id` ascending as a deterministic tie-breaker.

## Response

```json
{
  "data": [
    {
      "clientName": "Example Client",
      "servicePackage": "Mainland LLC Company Formation Package",
      "serviceCategory": "Business Setup",
      "packagePrice": "12500.00",
      "paymentStatus": "Paid",
      "serviceStatus": "Completed"
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

Missing Client Service or owning Client values are returned as `null`. An
empty result returns `200` with an empty `data` array. Invalid query input
returns `422 VALIDATION_FAILED` using the standard error envelope.
