# API Standards

## 1. Scope

These standards apply to all HTTP APIs. Resource reads may be REST-like;
business state changes use explicit action endpoints so intent and invariants
cannot be bypassed.

## 2. Base Contract

- Base path: `/api/v1`
- Media type: `application/json`
- JSON field names: `camelCase`
- Identifiers are opaque strings.
- Timestamps use ISO 8601 UTC, for example `2026-07-29T10:30:00Z`.
- Dates without time use `YYYY-MM-DD`.
- Enumerations use documented uppercase codes.
- Unknown request fields are rejected for state-changing requests.

## 3. Authentication and Headers

Protected requests require the selected authentication credential. Clients
should send:

| Header | Use |
| --- | --- |
| `Authorization` | Authentication credential |
| `X-Correlation-Id` | Optional client trace identifier; server creates one when absent |
| `Idempotency-Key` | Required for retriable create and business-action commands |
| `If-Match` | Required Lead/Follow-up version for an existing-record command |

Every response includes `X-Correlation-Id`. Successful writes return an `ETag`
representing the new version.

## 4. Response Envelope

Single-resource success:

```json
{
  "data": {
    "id": "opaque-id",
    "version": 3
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

Collection success:

```json
{
  "data": [],
  "page": {
    "nextCursor": null,
    "limit": 25
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

No state-changing endpoint returns success until the complete business
transaction has committed.

## 5. Error Contract

```json
{
  "error": {
    "code": "INVALID_TRANSITION",
    "message": "Lead cannot move from ASSIGNED to WON.",
    "details": [
      {
        "field": "targetStatus",
        "issue": "Allowed values are CONTACTED, FOLLOW_UP, LOST, CANCELLED."
      }
    ]
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

| HTTP | Error category |
| --- | --- |
| `400` | Malformed request or invalid query |
| `401` | Missing, invalid, expired, or revoked authentication |
| `403` | Authenticated but action is forbidden when disclosure is safe |
| `404` | Missing resource or intentionally concealed inaccessible resource |
| `409` | Duplicate confirmation required, idempotency mismatch, stale version, or business conflict |
| `422` | Semantically invalid input or invalid state transition |
| `429` | Rate limit exceeded |
| `500` | Unexpected internal failure |

Error `code` values are stable machine-readable identifiers. Messages are safe
for users and contain no stack trace, query, credential, or internal path.

## 6. Commands and CRUD Boundaries

Generic create/read/edit operations are permitted for non-lifecycle fields.
The following require named commands:

- assign or transfer a Lead;
- transition, lose, cancel, reopen, or win a Lead;
- schedule, complete, cancel, or mark a Follow-up missed;
- activate or deactivate a User;
- mark a Notification read.

Generic `PATCH /leads/{id}` must reject `ownerId`, `status`, terminal reasons,
audit fields, and `version`.

## 7. Validation

Validation occurs in this order:

1. syntax and content type;
2. authentication;
3. request shape and field constraints;
4. authorization and record scope;
5. current version and idempotency;
6. domain preconditions and state transition;
7. persistence constraints.

Domain rules remain authoritative even if equivalent validation exists in the
client.

## 8. Idempotency and Optimistic Concurrency

An idempotency key is scoped to the authenticated actor, endpoint, and request
payload. Reusing it with the same payload returns the original result; reusing
it with a different payload returns `409 IDEMPOTENCY_KEY_REUSED`.

Commands on existing records require the current version through `If-Match`.
A stale version returns `409 VERSION_CONFLICT` with the current version but
does not reveal an inaccessible resource.

## 9. Query Standards

- Cursor pagination is the default for growing collections. An
  endpoint-specific contract may explicitly define page/limit pagination.
- Default limit is 25; maximum is 100.
- Sort order must include a unique tie-breaker.
- Filters use documented query parameters and are combined with logical AND.
- Authorization scope is applied before pagination and aggregation.
- Free-text search is normalized and length-limited.
- Empty results return `200` with an empty array, not `404`.

## 10. Compatibility and Deprecation

Additive optional response fields are backward-compatible. Removing or
renaming fields, changing meanings, or tightening accepted enum values requires
a new API version or documented migration. Deprecated behavior must have an
announced removal date and test coverage during the transition.
