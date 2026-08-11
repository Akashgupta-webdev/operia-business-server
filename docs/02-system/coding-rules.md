# Coding Rules

## 1. Source of Truth

Read the relevant requirement, workflow, API, data, and ADR documents before
implementation. If code and approved documentation disagree, stop and resolve
the mismatch; do not silently preserve accidental behavior.

## 2. Business Logic

- Implement business actions as named application commands.
- Keep state transitions in domain code, never controllers, repositories, or UI
  conditionals.
- Do not expose generic setters for owner, status, terminal reasons, versions,
  or audit fields.
- Inject clock, identifier, and actor context so domain tests are deterministic.
- Use typed/domain-specific errors, not string matching.
- Make required Timeline, Audit, and Notification effects explicit in the
  command result.

## 3. Modules and Dependencies

Follow `folder-structure.md`. Domain code cannot import transport, persistence,
framework, or environment libraries. Modules access one another through public
application interfaces; direct cross-module persistence writes are prohibited.
Avoid cyclic dependencies.

## 4. Validation and Types

- Validate external input at the interface boundary and enforce invariants
  again in the domain.
- Normalize phone, email, enum, and time inputs in one shared, tested policy.
- Distinguish nullable, optional, empty, and missing values.
- Reject unknown write fields.
- Avoid untyped maps for domain commands and events.
- Never use floating-point values for money when financial fields are later
  introduced.

## 5. Persistence

- Application services own transaction boundaries.
- Repositories save/load aggregates; they do not decide business transitions.
- Use optimistic concurrency on mutable aggregates.
- Treat Timeline and Audit data as append-only.
- Add schema/data migrations for every persistent shape change.
- Do not make external network calls inside a database transaction.

## 6. API and Errors

Follow `api-standards.md`. Handlers map transport data to commands and map
results/errors back; they contain no business decisions. Responses never expose
stack traces, queries, credentials, normalized matching fields, or internal
paths.

## 7. Security and Privacy

- Never log passwords, tokens, full contact data, Note bodies, or Follow-up
  discussion summaries.
- Apply authorization before returning resource existence or aggregate counts.
- Use allow-lists for audit snapshots.
- Secrets come from validated runtime configuration, never source control.
- Dependency and static-security checks are part of CI.

## 8. Testing

Every business rule change includes:

- domain unit tests for valid and invalid behavior;
- integration tests for persistence, authorization, atomicity, and concurrency;
- API contract tests for response/error shapes;
- documentation updates when behavior or terminology changes.

Tests use fixed clocks and deterministic identifiers where order matters. Do
not weaken assertions or skip tests to make a change pass.

## 9. Quality Gates

Before merge: formatter, linter, type check, unit tests, integration tests,
security/dependency checks, and critical smoke tests must pass. New warnings are
failures unless an approved exception documents owner and expiry.
