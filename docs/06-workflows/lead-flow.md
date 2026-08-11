# Release 1 Lead Workflow

## 1. Purpose and Authority

This document is the authoritative Release 1 Lead state machine. It governs
status transitions, ownership, terminal outcomes, and required side effects.
The broader journey in `docs/master.md` is conceptual; where it differs, this
workflow controls Release 1 implementation.

## 2. Workflow Boundaries

Release 1 tracks a Lead from capture through a sales outcome. It does not
create Quotations, Customers, Policies, Renewals, Claims, or payment
transactions. Statuses such as `QUOTATION_SENT` and `PAYMENT_PENDING` describe
the agency's observed sales progress when that work occurs outside the Release
1 system.

`POLICY_ISSUED`, `RENEWAL_DUE`, and `CLAIM_SUPPORT` are not Lead states.
Renewal and claim support belong to future Policy, Renewal, and Claim
lifecycles. A future conversion workflow may connect a `WON` Lead to a
Customer and Policy without rewriting the Lead's history.

## 3. High-Level Flow

```text
                       +---------------------------+
                       | LOST or CANCELLED         |
                       | Admin may reopen          |
                       +-------------+-------------+
                                     |
                                     v
NEW -> ASSIGNED -> CONTACTED <-> FOLLOW_UP
                        |            |
                        v            v
                DOCUMENT_PENDING -> QUOTATION_PREPARING
                                           |
                                           v
                                  QUOTATION_SENT
                                      |         \
                                      v          v
                                NEGOTIATION -> PAYMENT_PENDING -> WON

Any non-terminal state may become LOST.
An Admin may CANCEL any non-terminal Lead.
```

## 4. State Definitions

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `NEW` | Captured but not owned. | `ASSIGNED`, `LOST`, `CANCELLED` |
| `ASSIGNED` | Owned by an active Agent; contact has not yet been confirmed. | `CONTACTED`, `FOLLOW_UP`, `LOST`, `CANCELLED` |
| `CONTACTED` | A completed customer contact has been recorded. | `FOLLOW_UP`, `DOCUMENT_PENDING`, `QUOTATION_PREPARING`, `LOST`, `CANCELLED` |
| `FOLLOW_UP` | Further customer engagement is currently required. | `CONTACTED`, `DOCUMENT_PENDING`, `QUOTATION_PREPARING`, `LOST`, `CANCELLED` |
| `DOCUMENT_PENDING` | Information or documents needed for the sales process are outstanding. | `CONTACTED`, `FOLLOW_UP`, `QUOTATION_PREPARING`, `LOST`, `CANCELLED` |
| `QUOTATION_PREPARING` | The agency is preparing an insurance proposal outside the Release 1 quotation module. | `DOCUMENT_PENDING`, `FOLLOW_UP`, `QUOTATION_SENT`, `LOST`, `CANCELLED` |
| `QUOTATION_SENT` | The proposal was delivered and the delivery method/time are recorded. | `FOLLOW_UP`, `NEGOTIATION`, `PAYMENT_PENDING`, `LOST`, `CANCELLED` |
| `NEGOTIATION` | The proposal is under discussion. | `FOLLOW_UP`, `QUOTATION_PREPARING`, `PAYMENT_PENDING`, `LOST`, `CANCELLED` |
| `PAYMENT_PENDING` | The agency is waiting for external confirmation of the agreed payment milestone. | `FOLLOW_UP`, `WON`, `LOST`, `CANCELLED` |
| `WON` | The agency confirms that the sales opportunity succeeded. | None |
| `LOST` | The opportunity ended unsuccessfully for a recorded business reason. | `ASSIGNED` by Admin reopen only |
| `CANCELLED` | The record was stopped for an administrative reason rather than a sales loss. | `ASSIGNED` by Admin reopen only |

## 5. Universal Transition Rules

1. Every state change is an explicit business action; generic Lead editing
   cannot change `status`.
2. Except for `NEW`, every active state requires an active Agent owner.
3. Admin may perform any valid transition. An Agent may transition only a Lead
   currently assigned to that Agent.
4. Only Admin may transition to `CANCELLED` or reopen a Lead.
5. Admin and the assigned Agent may transition to `LOST`.
6. `WON` is terminal in Release 1 and cannot be reopened.
7. Every transition requires optimistic concurrency using the current Lead
   version.
8. Each successful transition appends one business Timeline entry and one
   Audit Log entry in the same transaction.
9. Entering a terminal state cancels all `SCHEDULED` Follow-ups while retaining
   them in history.

## 6. Transition-Specific Data

| Transition | Additional required data |
| --- | --- |
| Any -> `CONTACTED` | Contact method, contact time, brief outcome |
| Any -> `FOLLOW_UP` | At least one scheduled Follow-up or a reason why scheduling is temporarily impossible |
| Any -> `DOCUMENT_PENDING` | Description of the outstanding information |
| `QUOTATION_PREPARING` -> `QUOTATION_SENT` | Sent time and delivery method; optional external reference |
| Any -> `PAYMENT_PENDING` | Expected milestone and expected date; no card or bank credentials |
| `PAYMENT_PENDING` -> `WON` | Success date and confirmation note |
| Any active -> `LOST` | Configured loss reason; explanation when reason is `OTHER` |
| Any non-terminal -> `CANCELLED` | Administrative cancellation reason |
| `LOST`/`CANCELLED` -> `ASSIGNED` | Reopen reason and active Agent owner |

## 7. Standard Loss Reasons

- `NO_RESPONSE`
- `NOT_INTERESTED`
- `PRICE`
- `COVERAGE_MISMATCH`
- `COMPETITOR_SELECTED`
- `NOT_ELIGIBLE`
- `DUPLICATE`
- `OTHER`

These codes support consistent reporting. `OTHER` requires explanatory text.
Cancellation reasons are separate: erroneous record, test record, invalid
contact, or another documented administrative reason.

## 8. Assignment and Transfer

Assignment changes a `NEW` Lead to `ASSIGNED`. Transfer preserves the current
business status because ownership and sales progress are separate concerns.
Transfer requires a reason and moves all open Follow-ups to the new Agent.
Historical Follow-ups retain their original performer. The old and new owner
are captured in Timeline and Audit Log entries, and the new owner receives an
in-app Notification.

## 9. Follow-up Subflow

```text
SCHEDULED -> COMPLETED
          -> CANCELLED
          -> MISSED
```

- `SCHEDULED` requires a future agency-local due date/time, communication
  method, and intended next action.
- `COMPLETED` requires discussion summary and outcome.
- `CANCELLED` requires a cancellation reason.
- `MISSED` records that the planned contact did not occur and requires an
  outcome or reason.
- “Overdue” is calculated when a `SCHEDULED` Follow-up is past due.
- Multiple Follow-ups are permitted; the earliest scheduled item is the Lead's
  derived next action.
- Completing one Follow-up and scheduling the next may be one atomic command.

## 10. History Events

The Timeline contains business-readable events such as Lead created, assigned,
transferred, contacted, status changed, Follow-up completed, marked Lost,
cancelled, reopened, and marked Won. Field edits that do not represent
business progress belong only in the Audit Log.

Timeline and Audit Log entries are append-only. A correction uses a new action
that references the superseded or incorrect event; it never edits history in
place.

## 11. Example Journey

```text
NEW
-> ASSIGNED
-> CONTACTED
-> DOCUMENT_PENDING
-> QUOTATION_PREPARING
-> QUOTATION_SENT
-> NEGOTIATION
-> PAYMENT_PENDING
-> WON
```

This is an example, not a requirement to visit every intermediate state. Only
the transitions in the state table are permitted.
