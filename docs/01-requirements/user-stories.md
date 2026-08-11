# Release 1 Lead Management User Stories

## 1. Purpose

These stories define the business value of the Release 1 Lead Management
slice. Requirement IDs refer to `business-requirements.md`; testable behavior
is defined in `acceptance-criteria.md`.

## 2. Admin Stories

### `US-ADM-001` Manage Agents

As an Admin, I want to create, activate, and deactivate Agent users, so that
only current staff can receive and work Leads.

Related requirements: `BR-IAM-003`.

### `US-ADM-002` Capture a Lead

As an Admin, I want to record a potential customer as a Lead, so that the
opportunity enters a controlled sales workflow.

Related requirements: `BR-LEAD-001`, `BR-LEAD-011`, `BR-LEAD-012`.

### `US-ADM-003` Assign a Lead

As an Admin, I want to assign an unassigned Lead to an active Agent, so that
responsibility and the next owner are unambiguous.

Related requirements: `BR-LEAD-003`, `BR-LEAD-004`.

### `US-ADM-004` Transfer a Lead

As an Admin, I want to transfer a Lead with a recorded reason, so that workload
can change without losing accountability or history.

Related requirements: `BR-LEAD-005`.

### `US-ADM-005` Monitor Workload

As an Admin, I want to filter Leads and view counts by status, owner, and
follow-up urgency, so that I can identify stalled work and balance assignments.

Related requirements: `BR-LEAD-015`, `BR-REP-001`.

### `US-ADM-006` Cancel or Reopen a Lead

As an Admin, I want to cancel an invalid opportunity or reopen a Lost or
Cancelled Lead with a reason, so that exceptional cases are controlled and
traceable.

Related requirements: `BR-LEAD-013`, `BR-LEAD-014`.

## 3. Agent Stories

### `US-AGT-001` View My Leads

As an Agent, I want to see only Leads assigned to me, prioritized by next
follow-up, so that I can focus on the work I own.

Related requirements: `BR-IAM-004`, `BR-LEAD-002`, `BR-LEAD-015`.

### `US-AGT-002` Create My Lead

As an Agent, I want to capture a Lead assigned to me, so that opportunities I
originate are immediately visible in my workload.

Related requirements: `BR-LEAD-011`, `BR-LEAD-012`.

### `US-AGT-003` Progress a Lead

As an Agent, I want to move my Lead through valid sales stages, so that its
status accurately communicates business progress.

Related requirements: `BR-LEAD-006`, `BR-LEAD-007`.

### `US-AGT-004` Schedule a Follow-up

As an Agent, I want to schedule a dated communication and intended next action,
so that customer contact is not forgotten.

Related requirements: `BR-FUP-001`, `BR-FUP-002`, `BR-FUP-003`.

### `US-AGT-005` Complete a Follow-up

As an Agent, I want to record what was discussed, the outcome, and optionally
the next Follow-up, so that future work has reliable context.

Related requirements: `BR-FUP-003`, `BR-FUP-004`, `BR-FUP-005`.

### `US-AGT-006` Record Context

As an Agent, I want to add Notes to my Lead, so that useful context is retained
without falsely presenting it as a completed interaction.

Related requirements: `BR-FUP-007`.

### `US-AGT-007` Close an Unsuccessful Lead

As an Agent, I want to mark my Lead Lost with a reason, so that inactive
opportunities do not remain in the active workload and loss causes can be
understood.

Related requirements: `BR-LEAD-008`, `BR-LEAD-010`.

### `US-AGT-008` Receive Assignment Notice

As an Agent, I want an in-app notification when a Lead is assigned or
transferred to me, so that I know new work requires attention.

Related requirements: `BR-WRK-001`, `BR-WRK-002`, `BR-WRK-004`.

## 4. Shared Traceability Stories

### `US-HIS-001` Understand Business History

As an authorized User, I want a chronological Lead Timeline, so that I can
understand business progress without reconstructing it from current fields.

Related requirements: `BR-HIS-001`, `BR-HIS-002`.

### `US-HIS-002` Audit Changes

As an Admin, I want important Lead actions to identify who acted, what changed,
and when, so that operational disputes and mistakes can be investigated.

Related requirements: `BR-HIS-003` through `BR-HIS-006`.

## 5. Release 1 Story Boundaries

These stories do not authorize quotation generation, file upload, Customer
conversion, policy issuance, renewal processing, claims, outbound email/SMS,
bulk import, lead merge, or automatic assignment. Those require their own
approved stories and acceptance criteria.
