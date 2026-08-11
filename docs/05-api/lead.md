# Release 1 Lead API

## 1. Purpose

This API exposes Lead reads, permitted profile edits, and explicit business
commands. It follows `docs/02-system/api-standards.md` and the state machine in
`docs/06-workflows/lead-flow.md`.

## 2. Lead Representation

```json
{
  "id": "lead-id",
  "displayName": "Asha Sharma",
  "phone": "+91 98XXXXXX10",
  "email": "asha@example.test",
  "source": "REFERRAL",
  "productInterest": "MOTOR",
  "owner": {
    "id": "user-id",
    "displayName": "Assigned Agent"
  },
  "status": "FOLLOW_UP",
  "nextAction": {
    "type": "FOLLOW_UP",
    "followUpId": "follow-up-id",
    "dueAt": "2026-07-30T05:30:00Z",
    "overdue": false
  },
  "version": 4,
  "createdAt": "2026-07-29T09:00:00Z",
  "updatedAt": "2026-07-29T10:00:00Z"
}
```

Terminal reason fields are returned when applicable. Normalized matching fields
and protected audit internals are never returned.

## 3. Endpoints

| Method and path | Action | Authorization |
| --- | --- | --- |
| `POST /api/v1/leads` | Create Lead | Admin; Agent assigned to self |
| `GET /api/v1/leads` | Search/filter permitted Leads | Admin all; Agent own |
| `GET /api/v1/leads/{leadId}` | Read Lead | Admin; assigned Agent |
| `PATCH /api/v1/leads/{leadId}` | Edit permitted non-lifecycle fields | Admin; assigned Agent |
| `POST /api/v1/leads/{leadId}/assign` | Assign `NEW` Lead | Admin |
| `POST /api/v1/leads/{leadId}/transfer` | Transfer owned active Lead | Admin |
| `POST /api/v1/leads/{leadId}/transitions` | Perform ordinary valid transition | Admin; assigned Agent |
| `POST /api/v1/leads/{leadId}/mark-lost` | Mark active Lead Lost | Admin; assigned Agent |
| `POST /api/v1/leads/{leadId}/cancel` | Cancel non-terminal Lead | Admin |
| `POST /api/v1/leads/{leadId}/reopen` | Reopen Lost/Cancelled Lead | Admin |
| `GET /api/v1/leads/{leadId}/timeline` | Read business history | Admin; assigned Agent |
| `GET /api/v1/leads/{leadId}/follow-ups` | Read Follow-ups | Admin; assigned Agent |
| `POST /api/v1/leads/{leadId}/follow-ups` | Schedule Follow-up | Admin; assigned Agent |
| `POST /api/v1/follow-ups/{id}/complete` | Complete and optionally schedule next | Admin; assigned Agent |
| `POST /api/v1/follow-ups/{id}/cancel` | Cancel Follow-up | Admin; assigned Agent |
| `POST /api/v1/follow-ups/{id}/mark-missed` | Mark missed | Admin; assigned Agent |
| `POST /api/v1/leads/{leadId}/notes` | Add Note | Admin; assigned Agent |

## 4. Create Lead

```json
{
  "displayName": "Asha Sharma",
  "phone": "+91 98765 43210",
  "email": "asha@example.test",
  "source": "REFERRAL",
  "productInterest": "MOTOR",
  "ownerId": null,
  "confirmPossibleDuplicate": false
}
```

At least one valid phone or email is required. Admin may omit or choose an
active Agent owner. Agent requests ignore no ownership choice: the server
assigns the Lead to the authenticated Agent. A possible duplicate returns
`409 POSSIBLE_DUPLICATE` with visible candidate summaries and a confirmation
token/key; resubmission with explicit confirmation creates a separate Lead.

## 5. List and Filter

`GET /leads` supports:

- `ownerId` (Admin only; Agent scope is implicit)
- `status`
- `source`
- `createdFrom`, `createdTo`
- `nextFollowUpFrom`, `nextFollowUpTo`
- `overdueFollowUp=true|false`
- `q` for bounded name/phone/email search
- `cursor`, `limit`, `sort`

Default sort is next Follow-up ascending with records lacking a next Follow-up
after scheduled records, then `updatedAt` descending and `id` ascending.

## 6. Edit Lead Profile

`PATCH /leads/{id}` accepts an allow-listed partial body containing
`displayName`, `phone`, `email`, `source`, and `productInterest`. It requires
`If-Match`. It rejects owner, status, terminal reason, payment, version,
next-action, and audit fields.

## 7. Assignment and Transfer

Assign:

```json
{
  "agentId": "active-agent-id"
}
```

Transfer:

```json
{
  "agentId": "new-active-agent-id",
  "reason": "Workload balancing"
}
```

Both require `Idempotency-Key` and `If-Match`. Assignment changes `NEW` to
`ASSIGNED`; transfer preserves status and moves scheduled Follow-ups.

## 8. Ordinary Transition

```json
{
  "targetStatus": "CONTACTED",
  "occurredAt": "2026-07-29T10:30:00Z",
  "contactMethod": "PHONE",
  "outcome": "Customer requested plan options"
}
```

Payload fields vary according to the transition-specific data table in
`lead-flow.md`. This endpoint cannot target `LOST`, `CANCELLED`, or reopen a
terminal Lead; named endpoints enforce those privileged actions.

## 9. Mark Lost, Cancel, and Reopen

Mark Lost:

```json
{
  "reason": "PRICE",
  "explanation": "Customer selected a lower-priced alternative."
}
```

Cancel:

```json
{
  "reason": "ERRONEOUS_RECORD",
  "explanation": "Created during data-entry training."
}
```

Reopen:

```json
{
  "agentId": "active-agent-id",
  "reason": "Customer requested a new discussion."
}
```

All require idempotency and the current version.

## 10. Follow-up Commands

Schedule:

```json
{
  "scheduledAt": "2026-07-30T05:30:00Z",
  "communicationMethod": "PHONE",
  "intendedNextAction": "Confirm vehicle registration details"
}
```

Complete:

```json
{
  "discussionSummary": "Registration details confirmed.",
  "outcome": "READY_FOR_QUOTATION",
  "nextFollowUp": {
    "scheduledAt": "2026-08-01T05:30:00Z",
    "communicationMethod": "PHONE",
    "intendedNextAction": "Discuss proposal"
  }
}
```

Completion and optional next Follow-up are atomic. Commands require the
Follow-up version and verify current Lead ownership.

## 11. Timeline

`GET /leads/{id}/timeline` uses cursor pagination in ascending chronological
order and returns business-safe structured events. It does not return Audit Log
before/after snapshots.

## 12. Important Errors

- `POSSIBLE_DUPLICATE`
- `LEAD_NOT_ASSIGNABLE`
- `ASSIGNEE_INACTIVE`
- `INVALID_TRANSITION`
- `TERMINAL_LEAD`
- `LOSS_REASON_REQUIRED`
- `REOPEN_NOT_ALLOWED`
- `FOLLOW_UP_NOT_SCHEDULED`
- `FOLLOW_UP_TIME_INVALID`
- `VERSION_CONFLICT`
- `IDEMPOTENCY_KEY_REUSED`

Every rejected command leaves Lead state and all required side effects
unchanged.
