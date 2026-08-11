# Insurance CRM Glossary

## 1. Purpose

This glossary defines the shared business language for the Insurance CRM. It is
intended for product owners, developers, testers, and AI coding assistants such
as Codex.

Use these definitions when reading requirements, naming code, designing APIs,
creating database models, and writing tests. A term must not be given a
different meaning in implementation unless the documentation is updated first.

This document is based on `docs/master.md`. It explains the terms introduced by
that document but does not replace detailed requirements, workflows, state
transition rules, or architecture decisions.

## 2. Interpretation Rules for Codex

- Treat documented business rules as the source of truth; do not infer a rule
  solely from a screen, endpoint, collection, or existing implementation.
- Model business workflows and actions, not merely CRUD operations.
- Keep a **Lead** and a **Customer** as separate concepts.
- Keep a **Business Timeline** and an **Activity Log** as separate records.
- Treat a **Follow-up** as a recorded business activity, not just a reminder.
- Do not assume that a suggested status, role, transition, or future feature is
  approved for the current release.
- When a term or transition is not defined, consult the relevant documentation
  or request clarification instead of inventing business behavior.
- If implementation changes the meaning of a business term, update this
  glossary and the affected business documentation in the same change.

## 3. Scope Labels

| Label | Meaning |
| --- | --- |
| Current | Part of the business model that current documentation may specify and implementation may support. |
| Planned | Within the eventual product scope, but not necessarily included in the initial version. |
| Future | An anticipated extension that must not be implemented or authorized without an explicit requirement. |
| Proposed | A candidate concept that requires confirmation in the relevant source-of-truth document. |

The initial version prioritizes a strong, extensible architecture. Inclusion in
the eventual project scope does not automatically make a feature part of the
initial release.

## 4. People and Roles

### Admin

A current system role responsible for administrative business operations. The
master document explicitly identifies lead assignment as an Admin capability.
Release 1 permissions are defined in `docs/02-system/auth.md`; the role name
must not be interpreted as unrestricted access beyond that matrix.

### Agent

A current system role representing a person who works assigned leads and
supports their progress through the insurance lifecycle. Typical activities
include contacting leads, gathering requirements, scheduling follow-ups, and
supporting quotation, policy, renewal, and claim workflows. Exact permissions
must come from the authorization and feature requirements.

### User

An authenticated person represented in the system. A User has a role such as
Admin or Agent. **User** describes system identity; **Agent** and **Admin**
describe business responsibility and authorization.

### Potential Customer

A person or organization that may purchase insurance but has not yet been
established as a Customer. In the CRM, this sales opportunity is represented by
a Lead.

### Customer

A person or organization with an established business relationship with the
agency or broker. A Customer is not synonymous with a Lead. The exact event and
rules that convert or link a Lead to a Customer must be specified in the lead
conversion workflow.

### Future Roles

**Branch Manager**, **Sales Manager**, **Telecaller**, **Accountant**, and
**Super Admin** are future role candidates. The current model supports only
Admin and Agent. Code and data models should remain extensible, but future roles
must not receive permissions or workflow behavior until documented.

## 5. Organizations and Insurance Products

### Insurance Agency / Broker

The business using the CRM to manage relationships and insurance operations
across leads, customers, quotations, policies, renewals, and claim support.

### Insurance Company

The insurer that offers an Insurance Plan and issues or underwrites an
insurance Policy. The CRM manages information and workflows involving the
company; it is not itself the insurer.

### Insurance Plan

An insurance offering made available by an Insurance Company and considered
when preparing a Quotation. Plan attributes and eligibility rules are not yet
defined by the master document and must not be assumed.

## 6. Core Business Objects

### Lead

A potential sales opportunity associated with a potential customer. A Lead is
not a Customer. It moves through a documented lifecycle as the business
contacts the prospect, understands requirements, prepares quotations, and
attempts to complete the sale.

A Lead may have an owner or assigned Agent, a current status, follow-ups,
notes, documents, quotations, business timeline entries, and activity logs.
The exact data shape belongs in requirements and database documentation.

### Lead Assignment

The business action that gives or transfers responsibility for a Lead to an
Agent. Assignment is more than editing an owner field: it may change the lead's
status and must create the timeline entry and notification required by the
acceptance criteria.

### Lead Ownership

The current responsibility for progressing a Lead. Ownership is normally
established through assignment or transfer. Ownership rules and the actions an
owner may perform must be explicitly documented.

### Lead Conversion

The business action that establishes the relationship between a successful
Lead and a Customer. The master document mentions **Convert Lead** as a
business-oriented API action but does not define its trigger, resulting records,
or relationship cardinality. Codex must not assume that conversion means only
changing a status.

### Follow-up

A scheduled and recorded business activity used to continue engagement with a
Lead or Customer. It contains:

- Scheduled date
- Communication method
- Discussion summary
- Outcome
- Next action
- Optional next follow-up

A Follow-up contributes to customer history. It is not merely a date, task, or
notification.

### Activity

A general record of work or interaction performed as part of the business
process. Where an Activity overlaps with a Follow-up, Timeline entry, or
Activity Log entry, use the more specific term. Its precise model must be
defined before implementation.

### Note

Human-authored contextual information attached to a relevant business record.
A Note is not automatically a Follow-up, business event, or system audit entry.

### Quotation

A proposal prepared for a Lead or Customer using insurance requirements and an
Insurance Plan. It progresses through preparation, delivery, and potentially
negotiation. Regenerating a quotation is a system action that should be
auditable; the detailed quotation contents and versioning rules require their
own specification.

### Payment

A business milestone occurring before policy issuance in the lifecycle
described by the master document. Payment processing, collection, verification,
failure handling, and financial accounting are not defined there and must not
be inferred.

### Policy

The issued insurance contract associated with a Customer, Insurance Company,
and insurance offering. A Policy has a lifecycle that may lead to renewal and
claim support. Policy data, ownership, validity dates, and state rules must be
defined before schema or API design.

### Renewal

The business process of continuing or replacing insurance coverage when a
Policy approaches the end of its applicable period. Renewal includes due-state
tracking, reminders, customer engagement, and completion. It is a workflow, not
only a date update.

### Renewal Reminder

A notification or scheduled communication triggered when a Policy approaches a
documented renewal threshold. Trigger timing, recipients, frequency, and
escalation behavior must be specified in the renewal workflow.

### Claim

An insurance-related matter for which the agency or Agent may provide support
after policy issuance. The CRM scope is described as **Claim Support**; this
does not imply that the CRM adjudicates, approves, rejects, or pays a claim.

### Task

A unit of work assigned to a User. A Task may support a workflow but is not
interchangeable with a Follow-up, Notification, or Timeline entry.

### Notification

A system-created message that informs a User about a business event or required
action, such as a lead assignment or renewal reminder. Release 1 supports a
persistent in-app assignment/transfer Notification with unread/read state.
Outbound channels, retry, and escalation behavior remain deferred.

### Document

A file or record stored in connection with a Lead, Customer, Quotation, Policy,
Renewal, or Claim. Examples may include documents received during requirement
gathering or policy documents. Document types, access control, retention,
versioning, and deletion rules must be explicitly defined.

## 7. History, Traceability, and Audit Terms

### Business Timeline

A chronological view of meaningful business progress for a Lead. Examples
include:

- Lead created
- Lead assigned to an Agent
- First contact completed
- Documents received
- Quotation generated
- Payment received
- Policy issued
- Renewal completed

Timeline entries answer **what happened in the business lifecycle**. They should
be meaningful to users reviewing the relationship history.

### Timeline Entry

One immutable or append-oriented business event displayed in the Business
Timeline. The exact immutability and correction rules must be defined, but an
implementation must not silently rewrite history.

### Activity Log

A chronological record of system actions. Examples include:

- User logged in
- Status updated
- Phone number edited
- Policy downloaded
- Quotation regenerated
- Document deleted

Activity Logs answer **what action occurred in the system**. They are not a
substitute for business timeline events.

### Audit Log

The durable trace used to establish who performed a system action, what
changed, and when it occurred. The master document lists Audit Log as a
business object while also describing Activity Logs. Until the audit
documentation defines whether they share storage, treat **Audit Log** as the
compliance and traceability concept and **Activity Log** as its
user-understandable system-action view.

### Customer History

The accumulated record of relevant interactions and business progress across
follow-ups, notes, documents, quotations, policies, renewals, and other
documented events. It must not be reduced to a single free-text field.

## 8. Lead Lifecycle Terms

The conceptual lifecycle in the master document is:

```text
Lead Generated
    -> Lead Assigned
    -> First Contact
    -> Requirement Gathering
    -> Follow-up
    -> Quotation Preparation
    -> Quotation Sent
    -> Negotiation
    -> Payment
    -> Policy Issued
    -> Renewal Reminder
    -> Renewal
    -> Claim Support
    -> Closed
```

This sequence explains the overall business journey. It is not, by itself, an
approved state-transition table. Some stages may repeat, be skipped under an
explicit rule, or occur in a related entity's lifecycle. Those rules belong in
the relevant workflow and state-machine documentation.

### Lead Generated

The Lead has entered the business from a documented source and is available for
qualification or assignment.

### First Contact

The first recorded communication attempt or completed communication with the
potential customer. Requirements must clarify whether an unsuccessful attempt
counts as First Contact.

### Requirement Gathering

The process of understanding the potential customer's insurance needs and
collecting the information required to evaluate plans or prepare a quotation.

### Negotiation

The stage after a quotation is sent in which details, price, coverage, or other
proposal terms may be discussed. Allowed changes and quotation versioning must
be defined separately.

### Policy Issuance

The business event in which an insurance Policy becomes issued. It must create
the appropriate policy record and history entries according to the policy
workflow; it is not merely a lead status update.

### Claim Support

Assistance provided by the agency or Agent for a claim-related matter. It does
not mean claim adjudication by the CRM.

### Closed

A general description for a lifecycle that no longer requires normal active
progression. Use a specific documented terminal result such as Won, Lost, or
Cancelled rather than implementing an ambiguous `CLOSED` status unless the
state machine explicitly defines one.

## 9. Release 1 Lead Status Vocabulary

The following Lead statuses are approved for Release 1. Their authoritative
transitions, business rules, and role permissions are defined in
`docs/06-workflows/lead-flow.md`.

| Status | Intended meaning |
| --- | --- |
| `NEW` | A newly generated Lead awaiting the next business action. |
| `ASSIGNED` | Responsibility for the Lead has been assigned to an Agent. |
| `CONTACTED` | Contact with the potential customer has been recorded. |
| `FOLLOW_UP` | Further engagement is required and should be represented by a scheduled Follow-up. |
| `DOCUMENT_PENDING` | Required customer or insurance information is still awaiting documentation. |
| `QUOTATION_PREPARING` | A Quotation is being prepared. |
| `QUOTATION_SENT` | A Quotation has been delivered to the potential customer through a documented method. |
| `NEGOTIATION` | The sent Quotation or proposed insurance arrangement is under discussion. |
| `PAYMENT_PENDING` | The business is waiting for a required payment milestone. |
| `WON` | The Lead resulted in the successful business outcome defined by the lead workflow. |
| `LOST` | The sales opportunity ended unsuccessfully for a recorded reason. |
| `CANCELLED` | The Lead process was intentionally stopped under a documented cancellation rule. |

`POLICY_ISSUED`, `RENEWAL_DUE`, and `CLAIM_SUPPORT` are excluded from the
Release 1 Lead state machine. They belong to future Policy, Renewal, and Claim
workflows. `WON` closes the Release 1 sales opportunity; it does not fabricate
a Customer or Policy record.

## 10. Business Actions

### Assign Lead

Assign responsibility for a Lead to an Agent and produce all required business
side effects, such as timeline and notification records.

### Transfer Lead

Move responsibility for an already assigned Lead from one Agent to another.
Authorization, transfer reason, history, and notification rules require
explicit requirements.

### Schedule Follow-up

Create a Follow-up with its business context, not only a date. Agents are
expected to be able to schedule multiple follow-ups; the master document's
example requirement describes them as unlimited.

### Generate Quotation

Create a Quotation from documented customer requirements and insurance
offering data. Generation rules and any version history must be specified.

### Upload Documents

Associate a Document with the appropriate business record while enforcing
document validation, authorization, and retention rules.

### Mark Lost

End the active sales opportunity with the `LOST` outcome and a documented
reason, subject to the approved state machine.

### Renew Policy

Complete the documented renewal workflow for a Policy. This is a business
operation and must not be implemented as a generic policy update.

## 11. Product and Engineering Terms

### Insurance CRM

The Customer Relationship Management platform used by insurance agencies and
brokers to manage the customer lifecycle from lead generation through policy
renewal and claim support.

### Business-first Design

The practice of defining the business purpose, actors, triggers, rules, and
outcomes before selecting technical structures.

### Workflow-driven Architecture

An architecture organized around business progression and actions. Features
should answer why they exist, who uses them, what triggers them, and what
happens next.

### Business Rule

An explicit constraint or decision that controls permitted business behavior.
Business rules belong in documentation and must be enforced consistently
across UI, API, service, and persistence layers.

### State Machine

The authoritative definition of valid statuses and transitions for an entity.
For each state it specifies purpose, allowed previous states, allowed next
states, governing rules, and responsible roles. A list of statuses alone is not
a state machine.

### Business-oriented API

An API designed around a meaningful action such as **Assign Lead**, **Schedule
Follow-up**, or **Renew Policy**. It exposes business intent and validations
rather than only generic create, read, update, and delete operations.

### CRUD

Create, Read, Update, and Delete. CRUD operations may exist as implementation
details, but they must not replace documented workflows or bypass business
rules.

### Acceptance Criteria

Testable conditions that define when a requirement is satisfied. This project
uses **Given / When / Then** form and includes important side effects such as
ownership changes, timeline updates, and notifications.

### User Story

A requirement expressed from a user's point of view:

```text
As a <role>,
I want <capability>,
so that <business value>.
```

The business-value clause is required context, not optional wording.

### Source of Truth

The maintained project documentation that governs business meaning and intended
behavior. Existing code is evidence of implementation, but it does not override
an explicit documented business rule without an approved documentation change.

### Initial Version

The first implementation phase, focused on establishing strong architecture
and the explicitly selected features. It must not be interpreted as requiring
every item in the eventual project scope.

## 12. Terms Requiring Further Specification

The master document introduces the following concepts without enough detail for
deterministic implementation:

- The exact Lead-to-Customer conversion event and relationship
- The future Lead-to-Customer conversion event and matching rules
- Quotation contents, comparison, versioning, approval, and expiration
- Payment processing and verification boundaries
- Policy lifecycle states and constraints
- Renewal trigger thresholds and reminder rules
- Claim-support scope and lifecycle
- Document types, access, retention, and deletion behavior
- Outbound Notification delivery channels, retry, and escalation behavior
- Whether a separate user-visible Activity Log is needed beyond the Release 1
  Timeline and Audit Log

These gaps are deliberate signals for further documentation. They are not
permission for an implementation to choose behavior silently.
