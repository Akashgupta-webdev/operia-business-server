# Client Detail API

This document is the frontend integration contract for retrieving one Client
and every record directly related through the Client MongoDB `_id`.

## Endpoint and Authorization

`GET /api/v1/client/{id}`

The endpoint requires an authenticated, active User with the `ADMIN` role.
Authentication uses the existing HTTP-only cookies.

`id` is the required 24-character hexadecimal MongoDB `_id` of the Client.
There is no request body and there are no query parameters.

## Response

The endpoint returns `200 OK` with the Client and all directly related
Companies, Members, Vehicles, Drivers, Services, Documents, Payments, and
Reminders. Related arrays are sorted by newest creation time first and use
MongoDB `_id` as a deterministic ascending tie-breaker.

```json
{
  "data": {
    "client": {},
    "companies": [],
    "members": [],
    "vehicles": [],
    "drivers": [],
    "services": [],
    "documents": [],
    "payments": [],
    "reminders": []
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

An existing Client with no records in a related collection returns an empty
array for that collection.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `404` | `CLIENT_NOT_FOUND` | No Client exists with the supplied `_id` |
| `422` | `VALIDATION_FAILED` | `id` is not a 24-character hexadecimal MongoDB identifier |
| `500` | `INTERNAL_ERROR` | The detail lookup failed unexpectedly |
