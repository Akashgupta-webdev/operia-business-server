# Release 1 System Architecture

## 1. Purpose

This document defines the logical architecture for the single-agency Release 1
Lead Management system. It translates approved business requirements into
module boundaries without choosing a web framework, database product, or cloud
provider. Technology selections require separate ADRs.

## 2. Architectural Drivers

- Enforce Lead and Follow-up state machines in one place.
- Commit business changes and required history consistently.
- Prevent an Agent from accessing another Agent's Leads.
- Support safe retries and concurrent users.
- Keep Lead, Customer, Quotation, Policy, Renewal, and Claim models separate.
- Allow later modules and organization ownership without premature
  multi-tenancy.
- Produce deterministic behavior that can be tested without the UI.

## 3. Architecture Style

Release 1 is a **modular monolith** with one deployable application and one
transactional data store. Modules communicate through explicit application
interfaces and domain events inside the application boundary.

```text
Web / Mobile Client
        |
        v
HTTP API and Authentication
        |
        v
Application Commands and Queries
        |
        +----------------+----------------+----------------+
        v                v                v                v
 Identity & Access     Leads          Follow-ups       History
                                          |          / Timeline
                                          |         /  Audit
                                          v        v
                                  Notifications / Reporting
        |
        v
Repository Ports + Transaction Boundary
        |
        v
Transactional Database
```

This avoids distributed-transaction complexity while the business model is
still growing. A module may be extracted only when operational evidence shows
that independent scaling or deployment is worth the added consistency cost.

## 4. Layers

### 4.1 Interface Layer

Handles HTTP concerns: authentication parsing, request validation, response
mapping, correlation IDs, rate limits, and API versioning. It must not contain
state-transition rules.

### 4.2 Application Layer

Exposes business commands such as `CreateLead`, `AssignLead`,
`TransitionLead`, and `CompleteFollowUp`, plus read-only queries. It:

- loads the authorized aggregate;
- checks the expected version;
- invokes domain behavior;
- persists the aggregate and required side effects in one transaction;
- maps known failures to standard API errors.

### 4.3 Domain Layer

Owns entity meaning, state machines, invariants, value normalization, and
business events. It has no dependency on HTTP, UI, database libraries, or
external messaging.

### 4.4 Infrastructure Layer

Implements repositories, transaction handling, identity/password adapters,
clock and identifier providers, logging, and optional outbound integrations.
Infrastructure failures must not be translated into false business success.

## 5. Module Responsibilities

| Module | Owns | Must not own |
| --- | --- | --- |
| Identity and Access | Users, roles, activation, authentication, authorization policy | Lead lifecycle |
| Leads | Lead identity, contact snapshot, source, owner, status, terminal reasons, version | Customer, Policy, or Claim records |
| Follow-ups | Scheduled interaction and its outcome | Notification delivery or generic tasks |
| Notes | Human-authored Lead context | Completed-contact events |
| History | Business Timeline and durable Audit Log | Current Lead state |
| Notifications | In-app assignment/transfer notices and read state | Lead ownership decisions |
| Reporting | Permission-filtered projections and counts | Source-of-truth business state |

Modules may reference another module's stable identifier but must not directly
write another module's tables or collections.

## 6. Command Processing

```text
Authenticate
 -> Authorize command and record scope
 -> Validate input
 -> Load current aggregate
 -> Verify expected version and idempotency key
 -> Execute domain transition
 -> Persist state + Timeline + Audit + Notification
 -> Commit
 -> Return current resource representation
```

All required effects of one command share a transaction. Read projections may
be updated synchronously in Release 1. Future external email/SMS delivery must
use a transactional outbox; an external call must never occur inside the core
database transaction.

## 7. Consistency and Concurrency

- Lead and Follow-up writes use optimistic concurrency.
- A monotonically increasing `version` is returned to clients and required for
  updates and commands.
- Retriable commands accept an idempotency key scoped to actor and operation.
- Timeline and Audit Log records are append-only.
- Assignment, transfer, terminal transitions, and Follow-up completion are
  atomic with their side effects.
- Server time in UTC is authoritative; agency timezone is used only for input
  interpretation and display.

## 8. Query Architecture

Queries are separate from commands at the application interface but do not
require separate infrastructure. Query services:

- apply authorization scope before filters;
- use stable cursor pagination;
- return derived next action and overdue flags;
- return aggregates calculated only from permitted records;
- never mutate state as a side effect of reading.

## 9. Security and Observability

Every request receives a correlation ID. Logs use structured fields and avoid
Lead contact details, credentials, tokens, Note text, and Follow-up summaries.
Security-relevant and business mutations write durable Audit Log entries.
Metrics should include request latency, error rate, command conflict rate,
overdue Follow-up counts, and failed transaction count without high-cardinality
personal data labels.

## 10. Failure Handling

Known validation, authorization, not-found, conflict, and invalid-transition
failures use the API error contract in `api-standards.md`. Unknown failures
return a generic error reference and preserve diagnostic detail only in secure
logs. A failed command must leave no partial Timeline, Notification, or Audit
record.

## 11. Evolution Boundaries

Future Customer, Quotation, Policy, Renewal, Claim, Document, and outbound
messaging modules integrate through application interfaces and stable domain
events. Future multi-agency support may add an Organization boundary to
identity and aggregate ownership; Release 1 must not add tenant fields or
tenant switching preemptively.

## 12. Architecture Validation

An implementation conforms when:

1. Domain tests run without HTTP or database infrastructure.
2. API handlers cannot bypass application commands for state changes.
3. Cross-module writes occur through application interfaces.
4. Atomic side effects and optimistic concurrency are integration-tested.
5. Authorization is applied to both individual resources and aggregate queries.
