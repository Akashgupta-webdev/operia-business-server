# Release 1 Lead Management Acceptance Criteria

## 1. Conventions

- Scenarios use Given / When / Then.
- “Assigned Agent” means the Lead's current owner.
- Every state-changing scenario must also satisfy `AC-COM-001`.
- Error responses must not partially change business state.

## 2. Common Transaction and Authorization Criteria

### `AC-COM-001` Atomic business action

Given an authorized state-changing request,
when the action succeeds,
then its business record changes, Timeline entries, Audit Log entries, and
required Notifications are committed as one consistent outcome,
and if any required effect fails, none of those effects is committed.

### `AC-COM-002` Unauthorized access

Given an Agent is not the Lead's assigned owner,
when the Agent attempts to view or change that Lead,
then the system denies the request without revealing protected Lead details,
and no business state changes.

### `AC-COM-003` Concurrent update

Given a User is viewing an older version of a Lead,
when another action has already changed that Lead and the User submits a
state-changing request,
then the system rejects the stale request,
returns the current version information,
and does not overwrite the newer change.

## 3. Lead Capture

### `AC-LEAD-001` Admin creates an unassigned Lead

Given an Admin supplies the required name, at least one contact method, and a
Lead source,
when the Admin creates the Lead without selecting an owner,
then the Lead is created in `NEW`,
and a Lead-created Timeline entry and Audit Log entry are appended.

### `AC-LEAD-002` Agent creates an owned Lead

Given an active Agent supplies valid Lead data,
when the Agent creates a Lead,
then the Lead is assigned to that Agent in `ASSIGNED`,
and creation and assignment are visible in the Timeline and Audit Log.

### `AC-LEAD-003` Missing contact method

Given a User supplies neither a valid phone number nor email address,
when Lead creation is submitted,
then validation fails,
and no Lead or history record is created.

### `AC-LEAD-004` Possible duplicate

Given an accessible Lead already has the same normalized phone number or email,
when an authorized User creates another Lead,
then the system returns the possible matches as a warning,
and creation requires explicit confirmation,
and the system does not merge the records.

## 4. Assignment and Transfer

### `AC-ASG-001` Assign an unassigned Lead

Given a `NEW` Lead and an active Agent,
when an Admin assigns the Lead,
then ownership changes to that Agent,
the status changes to `ASSIGNED`,
the Lead version increments,
a business Timeline entry and Audit Log entry are appended,
and the Agent receives one in-app Notification.

### `AC-ASG-002` Reject an invalid assignee

Given a Lead and a missing, inactive, or non-Agent User,
when an Admin attempts assignment,
then assignment fails,
and ownership, status, history, and Notifications remain unchanged.

### `AC-ASG-003` Transfer an owned Lead

Given an active non-terminal Lead owned by Agent A,
when an Admin transfers it to active Agent B with a reason,
then Agent B becomes the owner,
the business status is preserved,
open Follow-ups are reassigned to Agent B,
the reason and both owners appear in history,
and Agent B receives one in-app Notification.

### `AC-ASG-004` Reject transfer without change

Given a Lead is already assigned to Agent A,
when an Admin attempts to transfer it to Agent A,
then the request fails as having no business effect,
and no history or Notification is created.

## 5. Lead Progression

### `AC-STS-001` Valid transition

Given an active Lead and a transition allowed by `lead-flow.md`,
when an authorized User supplies all transition-specific information,
then the status changes,
the Lead version increments,
and the prior and new states appear in the Timeline and Audit Log.

### `AC-STS-002` Invalid transition

Given a Lead in a particular state,
when a User requests a transition not listed for that state,
then the system rejects the request with the allowed next states,
and no state or history changes.

### `AC-STS-003` Mark Lost

Given an active Lead,
when an Admin or its assigned Agent marks it `LOST` with a configured loss
reason and optional explanation,
then the Lead becomes terminal,
open Follow-ups are cancelled with the system reason “Lead marked Lost”,
and the loss reason is retained in business history.

### `AC-STS-004` Cancel Lead

Given a non-terminal Lead,
when an Admin cancels it with a cancellation reason,
then the Lead becomes `CANCELLED`,
open Follow-ups are cancelled,
and the reason is retained in business history.

### `AC-STS-005` Reopen Lead

Given a `LOST` or `CANCELLED` Lead and an active Agent,
when an Admin reopens it with a reason,
then it becomes `ASSIGNED` to the selected Agent,
the terminal reason remains in history,
and a new assignment Notification is created.

### `AC-STS-006` Won is terminal

Given a `WON` Lead,
when any User attempts to reopen or change its status,
then the request is rejected,
and no Lead, Timeline, Audit Log, or Notification record changes.

## 6. Follow-ups and Notes

### `AC-FUP-001` Schedule Follow-up

Given an accessible non-terminal Lead,
when an Admin or assigned Agent supplies a future due time, supported
communication method, and intended next action,
then a `SCHEDULED` Follow-up is appended,
and the Lead's next action resolves to the earliest scheduled Follow-up.

### `AC-FUP-002` Complete Follow-up

Given a `SCHEDULED` Follow-up,
when an authorized User records a discussion summary and outcome,
then it becomes `COMPLETED`,
the completion appears in the Timeline and Audit Log,
and any new Follow-up supplied in the same action is independently created.

### `AC-FUP-003` Preserve multiple Follow-ups

Given a Lead has existing Follow-ups,
when another Follow-up is scheduled,
then no earlier Follow-up is replaced or deleted,
and next action is recalculated from remaining scheduled Follow-ups.

### `AC-FUP-004` Overdue derivation

Given a `SCHEDULED` Follow-up has a due time earlier than the current agency
time and is not completed or cancelled,
when it is queried,
then it is reported as overdue without changing its stored status.

### `AC-FUP-005` Add Note

Given an accessible non-terminal Lead,
when an authorized User adds non-empty Note text,
then the Note is stored with its author and time,
and an Audit Log entry is appended,
but no completed-contact Timeline event is fabricated.

## 7. Search, Dashboard, Timeline, and Notification

### `AC-VIEW-001` Agent data scope

Given an Agent searches Leads or requests dashboard counts,
when results are returned,
then every Lead and aggregate belongs to that Agent's current assignment.

### `AC-VIEW-002` Admin filtering

Given an Admin requests Leads with valid owner, status, source, creation-date,
or next-follow-up filters,
when results are returned,
then all filters are combined consistently,
and pagination uses a stable order.

### `AC-HIS-001` Append-only history

Given a Timeline or Audit Log entry exists,
when a correction is required,
then the original entry remains unchanged,
and the correcting business action creates a linked compensating entry.

### `AC-NOT-001` Assignment notification idempotency

Given the same assignment command is safely retried with the same idempotency
key,
when the original action already succeeded,
then the prior result is returned,
and no duplicate Notification, Timeline, or Audit Log entry is created.

## 8. Release Readiness

Release 1 is acceptable only when every criterion above has automated coverage
at the appropriate unit or integration layer and the critical smoke scenarios
in `docs/07-testing/smoke-test.md` pass.
