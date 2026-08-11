# Insurance CRM Business Requirements

## 1. Purpose

This document defines what the Insurance CRM must accomplish for the insurance
agency. It describes business outcomes, capabilities, rules, and boundaries
without prescribing database schemas, endpoints, frameworks, or UI layouts.

It is derived from:

- `docs/00-product/vision.md`
- `docs/00-product/glossary.md`

Detailed user behavior belongs in `user-stories.md`; testable scenarios belong
in `acceptance-criteria.md`; state transitions belong in workflow documents.

## 2. Requirement Language and Scope

**Must** indicates required behavior once the associated capability is approved
for a release. **May** indicates permitted behavior that still requires an
approved requirement before implementation.

| Scope | Meaning |
| --- | --- |
| Release 1 | Confirmed for the first release. |
| Release TBD | Part of the product direction, but its release has not been selected. |
| Future | Explicitly excluded from Release 1 and reserved for later evolution. |

Requirements marked **Release TBD** must not be implemented merely because they
appear in this document. Release selection is a product decision.

## 3. Business Objectives

| ID | Objective |
| --- | --- |
| `BO-001` | Provide one reliable operating system for the agency's customer lifecycle. |
| `BO-002` | Give every active Lead clear ownership, status, history, and next action. |
| `BO-003` | Reduce missed follow-ups and renewal opportunities. |
| `BO-004` | Preserve customer context across quotations, policies, renewals, and claim support. |
| `BO-005` | Make business progress and system actions independently traceable. |
| `BO-006` | Enforce documented workflows consistently instead of relying on informal practices. |
| `BO-007` | Establish a production-ready foundation that can evolve without replacing the core business model. |

## 4. Release 1 Business Context

| ID | Requirement |
| --- | --- |
| `BR-CTX-001` | Release 1 must serve one insurance agency. |
| `BR-CTX-002` | Release 1 must support only the Admin and Agent roles. |
| `BR-CTX-003` | The Admin and Agent roles must receive only explicitly documented permissions. The Admin role must not imply unrestricted access by default. |
| `BR-CTX-004` | Release 1 must not provide tenant isolation, organization switching, subscription management, or multi-tenant user experiences. |
| `BR-CTX-005` | Agency-specific names, settings, and behavior must remain identifiable so future organizational boundaries can be introduced without redefining the insurance workflows. |
| `BR-CTX-006` | Branch Manager, Sales Manager, Telecaller, Accountant, and Super Admin must remain future roles until separately approved. |

## 5. Business Capability Requirements

### 5.1 Users and Access

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-IAM-001` | Release 1 | The system must identify each User who performs a protected business action. |
| `BR-IAM-002` | Release 1 | The system must authorize business actions according to the User's documented role and, where applicable, record ownership. |
| `BR-IAM-003` | Release 1 | An Admin must be able to create, activate, and deactivate Agent users, subject to documented authorization rules. |
| `BR-IAM-004` | Release 1 | An Agent must be able to access only Leads assigned to that Agent; an Admin may access all Leads. |

### 5.2 Lead Management

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-LEAD-001` | Release 1 | The system must record a potential sales opportunity as a Lead, not as a Customer. |
| `BR-LEAD-002` | Release 1 | Each active Lead must expose its current owner, business status, history, and next required action. |
| `BR-LEAD-003` | Release 1 | An Admin must be able to assign an unassigned Lead to an active Agent. |
| `BR-LEAD-004` | Release 1 | Lead assignment must update ownership and produce the required Timeline entry, Audit Log entry, and in-app Notification. |
| `BR-LEAD-005` | Release 1 | An Admin must be able to transfer an assigned Lead to another active Agent after supplying a transfer reason. |
| `BR-LEAD-006` | Release 1 | A Lead must progress only through transitions permitted by the Lead state machine in `docs/06-workflows/lead-flow.md`. |
| `BR-LEAD-007` | Release 1 | Each Lead state must define its purpose, allowed next states, business rules, and authorized role. |
| `BR-LEAD-008` | Release 1 | An Admin or the assigned Agent must be able to mark an active Lead as Lost with a recorded reason. |
| `BR-LEAD-009` | Release TBD | Lead conversion must establish the documented relationship between a successful Lead and a Customer; it must not be treated as only a status change. |
| `BR-LEAD-010` | Release 1 | The system must retain the business history of a Won, Lost, or Cancelled Lead. |
| `BR-LEAD-011` | Release 1 | An Admin must be able to create a Lead; an Agent may create a Lead only when it is assigned to that Agent. |
| `BR-LEAD-012` | Release 1 | The system must warn an authorized User about possible duplicates found by normalized phone number or email address without silently merging records. |
| `BR-LEAD-013` | Release 1 | Lead cancellation must be restricted to an Admin and require a reason distinct from a Lost reason. |
| `BR-LEAD-014` | Release 1 | An Admin may reopen a Lost or Cancelled Lead into `ASSIGNED` with a reason and an active owner; a Won Lead cannot be reopened in Release 1. |
| `BR-LEAD-015` | Release 1 | The system must support searching and filtering Leads by permitted ownership, status, source, creation period, and next follow-up date. |

The approved Release 1 transitions and role rules are defined in
`docs/06-workflows/lead-flow.md`.

### 5.3 Follow-ups and Interaction History

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-FUP-001` | Release 1 | An Admin or assigned Agent must be able to schedule and record Follow-ups for an accessible Lead. |
| `BR-FUP-002` | Release 1 | The business must not impose a fixed limit on the number of Follow-ups associated with a Lead. |
| `BR-FUP-003` | Release 1 | A scheduled Follow-up must record its due date and time, communication method, and intended next action; completion must additionally record an outcome and discussion summary. |
| `BR-FUP-004` | Release 1 | Completing a Follow-up may schedule a subsequent Follow-up without replacing the earlier record. |
| `BR-FUP-005` | Release 1 | Completed Follow-ups must contribute to the Lead's enduring interaction history. |
| `BR-FUP-006` | Release 1 | A Follow-up must remain distinct from a reminder, Task, Notification, Note, or generic Activity. |
| `BR-FUP-007` | Release 1 | An Admin or assigned Agent must be able to add contextual Notes to an accessible non-terminal Lead without presenting them as completed business events. |
| `BR-FUP-008` | Release 1 | Follow-ups must use `SCHEDULED`, `COMPLETED`, `CANCELLED`, or `MISSED`; overdue is derived from a scheduled time in the past and is not a stored status. |
| `BR-FUP-009` | Release 1 | Cancelling or marking a Follow-up missed must retain the record and require a reason or outcome. |

### 5.4 Customers

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-CUS-001` | Release TBD | The system must maintain Customer records separately from Lead records. |
| `BR-CUS-002` | Release TBD | A Customer must retain relevant history across interactions, Documents, Quotations, Policies, Renewals, and claim support. |
| `BR-CUS-003` | Release TBD | The system must prevent Lead conversion from silently discarding or duplicating existing business history. |
| `BR-CUS-004` | Release TBD | The rules for creating, matching, converting, or linking a Customer must be approved before Customer implementation. |

### 5.5 Insurance Companies and Plans

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-CAT-001` | Release TBD | The system must distinguish the insurance agency using the CRM from an Insurance Company that offers insurance. |
| `BR-CAT-002` | Release TBD | The system must maintain the Insurance Companies and Insurance Plans required by approved quotation and policy workflows. |
| `BR-CAT-003` | Release TBD | Plan attributes and eligibility rules must be explicitly documented before they control quotation behavior. |

### 5.6 Quotations

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-QUO-001` | Release TBD | An authorized User must be able to prepare a Quotation from documented insurance requirements and plan information. |
| `BR-QUO-002` | Release TBD | The system must distinguish quotation preparation, delivery, and negotiation as business events where required by the approved workflow. |
| `BR-QUO-003` | Release TBD | The system must retain enough quotation history to make regeneration and material changes traceable. |
| `BR-QUO-004` | Release TBD | Quotation contents, comparison, versioning, approval, delivery, and expiration rules must be approved before implementation. |

### 5.7 Documents

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-DOC-001` | Release TBD | Authorized Users must be able to store and retrieve Documents associated with the relevant business record. |
| `BR-DOC-002` | Release TBD | The system must preserve the business context of each Document, including what it supports and when it was received or produced. |
| `BR-DOC-003` | Release TBD | Document type, access, validation, retention, versioning, and deletion rules must be approved before document storage is implemented. |
| `BR-DOC-004` | Release TBD | Document deletion must be traceable when deletion is permitted. |

### 5.8 Payment Milestone and Policy

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-POL-001` | Release TBD | The system may record a documented payment milestone required by the policy workflow. |
| `BR-POL-002` | Release TBD | The system must not process payments or provide accounting behavior without separately approved requirements. |
| `BR-POL-003` | Release TBD | The system must record an issued Policy as a business object distinct from the Lead that produced the opportunity. |
| `BR-POL-004` | Release TBD | A Policy must retain its relationship to the Customer, Insurance Company, and applicable insurance offering. |
| `BR-POL-005` | Release TBD | Policy issuance must create the required business-history and system-action records. |
| `BR-POL-006` | Release TBD | Policy lifecycle states, dates, ownership, validation, and constraints must be approved before implementation. |
| `BR-POL-007` | Release 1 | `POLICY_ISSUED` must not be implemented as a Lead state; Release 1 uses `WON` as the successful terminal Lead outcome without creating a Policy. |

### 5.9 Renewals

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-REN-001` | Release TBD | The system must identify Policies that enter a documented renewal window. |
| `BR-REN-002` | Release TBD | The system must generate renewal reminders according to approved timing, recipient, frequency, and escalation rules. |
| `BR-REN-003` | Release TBD | Authorized Users must be able to progress and complete a Policy renewal as a business workflow, not as a generic date update. |
| `BR-REN-004` | Release TBD | Renewal completion must preserve the relationship and history between the prior Policy, the Customer, and the resulting coverage. |
| `BR-REN-005` | Release 1 | Renewal state must not be placed on the Lead. |

### 5.10 Claim Support

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-CLM-001` | Release TBD | Authorized Users must be able to record and manage the agency's claim-support activities for a Customer and Policy. |
| `BR-CLM-002` | Release TBD | Claim-support history must remain connected to the relevant Customer and Policy. |
| `BR-CLM-003` | Release TBD | The CRM must not adjudicate, approve, reject, or pay a Claim. |
| `BR-CLM-004` | Release 1 | Claim-support state must not be placed on the Lead. |

### 5.11 Tasks and Notifications

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-WRK-001` | Release 1 | The system must create an in-app Notification when a Lead is assigned or transferred to an Agent. |
| `BR-WRK-002` | Release 1 | A Notification must identify its recipient and the Lead and business event that caused it. |
| `BR-WRK-003` | Release TBD | The system may support assignable Tasks when an approved workflow requires a unit of work distinct from a Follow-up. |
| `BR-WRK-004` | Release 1 | Release 1 Notifications must be persistent in-app records with unread/read state; outbound channels, delivery retries, and escalation are deferred. |

### 5.12 Timelines and Auditability

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-HIS-001` | Release 1 | Every Lead must have a chronological Timeline of meaningful business events. |
| `BR-HIS-002` | Release 1 | Timeline entries must explain business progress in terms understandable to Admins and Agents. |
| `BR-HIS-003` | Release 1 | The system must record important system actions in an Audit Log separate from the Business Timeline. |
| `BR-HIS-004` | Release 1 | Audit entries must identify the actor, action, target, timestamp, and relevant before-and-after values. |
| `BR-HIS-005` | Release 1 | Timeline and Audit Log entries must be append-only; corrections occur through a compensating action that preserves the original record. |
| `BR-HIS-006` | Release 1 | Release 1 uses the Audit Log as the system-action record; a separate user-visible Activity Log is deferred. |

### 5.13 Reports and Dashboard Analytics

| ID | Scope | Requirement |
| --- | --- | --- |
| `BR-REP-001` | Release 1 | The system must provide Lead counts by status and ownership and due or overdue Follow-up counts using documented definitions and the viewer's permitted data. |
| `BR-REP-002` | Release TBD | Metrics must define their source, calculation, time period, filters, and permitted audience before implementation. |
| `BR-REP-003` | Release TBD | Numeric success targets and operational KPIs require business baselines and separate product approval. |

## 6. Cross-Capability Business Rules

| ID | Requirement |
| --- | --- |
| `BR-RUL-001` | A business action must validate its documented preconditions before changing business state. |
| `BR-RUL-002` | One business action must produce all documented state changes, history, audit, and notification effects as one consistent outcome. |
| `BR-RUL-003` | A generic record update must not bypass a state machine, authorization rule, or required business side effect. |
| `BR-RUL-004` | Business terms and record meanings must remain consistent with the Glossary. |
| `BR-RUL-005` | Undocumented behavior must not be inferred from a page, field, endpoint, database record, or existing code. |
| `BR-RUL-006` | Changes to approved business behavior must update the affected requirements and workflow documentation. |
| `BR-RUL-007` | Business validation and error outcomes must be understandable to the User performing the action. |

## 7. Release 1 Exclusions

The following are explicitly outside Release 1:

- Multi-agency operation
- Tenant isolation or tenant identifiers
- Organization switching
- Subscription and billing management
- Multi-tenant administration or user interfaces
- Future roles not explicitly promoted into Release 1
- Claim adjudication or payment
- Payment processing and accounting, unless separately approved
- Any Release TBD capability not selected for Release 1

Future readiness must not be used as justification to implement excluded
features.

## 8. Business Acceptance

A selected capability is ready for implementation only when:

1. Its Release 1 inclusion is confirmed.
2. Actors and permissions are documented.
3. Business rules and lifecycle transitions are unambiguous.
4. Required history, audit, and notification effects are specified.
5. User stories identify the business value.
6. Acceptance criteria cover success, validation, authorization, and important
   failure paths.

If any condition is missing, Codex must ask for a product decision rather than
choose business behavior.

## 9. Pending Product Decisions

The following decisions are still required:

1. The Lead-to-Customer conversion rule and duplicate Customer matching.
2. Quotation contents, comparison, approval, delivery, and lifecycle.
3. Policy lifecycle and the relationship between policy issuance and a Won Lead.
4. Renewal timing and reminder behavior.
5. Document governance.
6. Outbound notification channels and delivery expectations.
7. Whether a separate user-visible Activity Log is needed in addition to the
   Release 1 Business Timeline and Audit Log.

These items are decision points, not implementation gaps to be filled by
assumption.
