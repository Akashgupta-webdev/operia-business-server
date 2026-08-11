# Release 1 Unit and Integration Test Strategy

## 1. Testing Layers

| Layer | Purpose |
| --- | --- |
| Domain unit | State transitions, invariants, reasons, next-action rules |
| Application unit | Command orchestration, authorization policy calls, emitted effects |
| Repository integration | Constraints, indexes, optimistic concurrency, transactions |
| API contract | Validation, status codes, envelopes, headers, data scoping |
| Smoke | Critical deployed user journeys |

Tests should favor meaningful behavior coverage over a numeric line-coverage
target. All state-machine edges and permission rows require coverage.

## 2. Lead Domain Matrix

For every state in `lead-flow.md`, test:

- each allowed next state succeeds with required data;
- at least one disallowed next state returns `INVALID_TRANSITION`;
- missing transition-specific data fails;
- Agent ownership and Admin-only rules are enforced;
- version increments once on success and never on failure;
- terminal transition cancels scheduled Follow-ups;
- `WON` rejects reopen; `LOST` and `CANCELLED` allow Admin reopen only.

## 3. Follow-up Tests

- Scheduling requires a future time, method, and intended action.
- Completing requires summary and outcome.
- Cancel/missed requires a reason.
- Only `SCHEDULED` can complete/cancel/be marked missed.
- Multiple Follow-ups are preserved.
- Earliest scheduled Follow-up becomes next action.
- Overdue is derived without a write.
- Lead transfer moves scheduled ownership but preserves completed performer.
- Complete-and-schedule-next is atomic.

## 4. Authorization Tests

Build a table-driven suite from `auth.md` for Admin, owning Agent, non-owning
Agent, inactive User, and unauthenticated caller. Cover details, lists, search,
counts, duplicate warnings, Timeline, Follow-ups, Notes, Audit, and
Notifications. Verify inaccessible records do not leak through `403`/`404`
differences, counts, or candidate summaries.

## 5. Persistence and Concurrency Tests

- Unique login, Notification, and idempotency constraints hold.
- A stale `If-Match` cannot overwrite a current Lead or Follow-up.
- Competing assignments have one winner and one version conflict.
- Command rollback removes partial Lead, Timeline, Audit, and Notification
  writes after injected failure.
- Same idempotency key/payload returns original result without duplicates.
- Same key with different payload returns a conflict.
- Timeline/Audit update and delete operations are unavailable.

## 6. API Contract Tests

Verify JSON shape, UTC timestamps, cursor behavior, maximum page size, stable
sorting, unknown-field rejection, correlation IDs, ETags, error codes, and safe
error messages. Generic Lead patch must reject protected lifecycle fields.

## 7. Test Data

Factories must create valid records by default and make exceptional invalid
states explicit. Use fictional contact information, fixed UTC times, and
deterministic identifiers. Never copy production personal data into tests.

## 8. CI Order

Run format/lint/type checks and domain tests first, then integration and API
contract tests. Smoke tests run against the deployable artifact. A failed
required suite blocks release.
