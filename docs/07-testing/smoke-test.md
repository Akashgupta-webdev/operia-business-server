# Release 1 Smoke Tests

## 1. Purpose

Smoke tests prove that the deployed system's critical Lead Management journeys
work with real authentication, API routing, persistence, and authorization.
They are small, repeatable, and safe to run in an isolated test environment.

## 2. Critical Scenarios

### `SMK-001` Admin capture and assignment

1. Authenticate as Admin.
2. Create an unassigned Lead and verify `NEW`.
3. Assign it to an active Agent.
4. Verify `ASSIGNED`, owner, Timeline, Audit entry, and one Agent Notification.

### `SMK-002` Agent progression and Follow-up

1. Authenticate as the assigned Agent.
2. Record contact and verify `CONTACTED`.
3. Schedule a future Follow-up and verify next action.
4. Complete it with summary/outcome and schedule the next Follow-up.
5. Verify both history records and the recalculated next action.

### `SMK-003` Ownership isolation and transfer

1. Verify another Agent cannot discover the Lead through detail, search, or
   dashboard counts.
2. Admin transfers the Lead with a reason.
3. Verify the former owner loses access, the new owner gains access, open
   Follow-ups move, and one Notification is created.

### `SMK-004` Invalid transition rollback

1. Attempt a state transition not allowed by `lead-flow.md`.
2. Verify `INVALID_TRANSITION`.
3. Verify Lead version, status, Timeline, Audit, and Notifications are
   unchanged.

### `SMK-005` Terminal and reopen behavior

1. Mark an owned Lead Lost with a reason.
2. Verify scheduled Follow-ups are cancelled and Agent cannot modify it.
3. Admin reopens it to an active Agent with a reason.
4. Verify `ASSIGNED`, preserved loss history, ownership, and Notification.

### `SMK-006` Idempotent retry

1. Repeat a successful assignment or transfer using the same idempotency key
   and identical payload.
2. Verify the original response and no duplicate Timeline, Audit, or
   Notification records.

### `SMK-007` User deactivation guard

1. Attempt to deactivate an Agent who owns an active Lead.
2. Verify `USER_OWNS_ACTIVE_LEADS`.
3. Transfer the Lead, retry, and verify the Agent becomes inactive and cannot
   authenticate anew.

## 3. Pass Criteria

Every scenario passes without manual data repair; no unexpected server error or
sensitive value appears in responses/logs; and cleanup is limited to the
isolated smoke-test dataset. Any critical failure blocks deployment.
