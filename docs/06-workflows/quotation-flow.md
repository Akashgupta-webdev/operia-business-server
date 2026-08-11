# Quotation Workflow

## Status

Deferred; not part of Release 1 Lead Management.

Release 1 may place a Lead in `QUOTATION_PREPARING`, `QUOTATION_SENT`, or
`NEGOTIATION` to record observed progress, but it does not create a Quotation
record or document.

Before implementation, this workflow must define:

- requirement and Insurance Plan inputs;
- draft, version, approval, sent, accepted, rejected, and expired semantics;
- comparison and material-change rules;
- delivery evidence and expiration;
- authorization and ownership;
- accepted quotation relationship to payment, `WON`, Customer, and Policy;
- Timeline, Audit, Notification, and document-retention effects.

Lead status alone must never be treated as a substitute for an approved
Quotation aggregate.
