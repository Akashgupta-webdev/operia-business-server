# Release 1 Logical Data Model

## 1. Purpose

This document defines persistence responsibilities and constraints without
selecting a relational or document database. “Collection” means a logical set
of records; a physical implementation may use tables.

Common rules:

- identifiers are opaque and immutable;
- timestamps are stored in UTC;
- mutable aggregate roots have an integer `version`;
- normalized contact fields support matching but are not displayed;
- Timeline and Audit records are append-only;
- historical actor references survive User deactivation.

## 2. Users

| Field | Meaning / constraint |
| --- | --- |
| `id` | Immutable User identifier |
| `name` | Required business display name |
| `email` | Required normalized unique email |
| `role` | `ADMIN` or `AGENT` |
| `status` | `ACTIVE` or `INACTIVE` |
| `accessKey` | SHA-256 digest of a generated high-entropy login key; never returned |
| `refreshKeyHash` | Digest of the current rotating refresh token; never returned |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC audit timestamps |

An inactive Agent cannot own active Leads. Deactivation is blocked until those
Leads are transferred.

## 3. Leads

| Field | Meaning / constraint |
| --- | --- |
| `id` | Immutable Lead identifier |
| `displayName` | Required prospect/person/organization name |
| `phone`, `normalizedPhone` | Optional contact pair |
| `email`, `normalizedEmail` | Optional contact pair |
| `source` | Required configured source code |
| `productInterest` | Optional plain category/reference; not an Insurance Plan |
| `ownerId` | Nullable only while status is `NEW` |
| `status` | State from `lead-flow.md` |
| `lossReason`, `lossExplanation` | Present only for current `LOST` state |
| `cancellationReason` | Present only for current `CANCELLED` state |
| `wonAt`, `successNote` | Present for `WON` |
| `documentPendingDetail` | Current stage context when relevant |
| `paymentMilestone`, `paymentExpectedAt` | External milestone description only |
| `nextFollowUpAt` | Derived/cache of earliest `SCHEDULED` Follow-up; nullable |
| `version` | Increments on every Lead aggregate mutation |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Actor and UTC timestamps |

At least one of phone or email is required. Generic updates cannot modify
owner, status, terminal reason fields, `nextFollowUpAt`, version, or audit
fields. Historical values belong in the Audit Log, not repeated arrays inside
the Lead record.

## 4. Follow-ups

| Field | Meaning / constraint |
| --- | --- |
| `id`, `leadId` | Follow-up and parent Lead |
| `ownerId` | Agent currently responsible for a scheduled Follow-up |
| `status` | `SCHEDULED`, `COMPLETED`, `CANCELLED`, or `MISSED` |
| `scheduledAt` | Required UTC due time |
| `communicationMethod` | Configured code such as `PHONE`, `EMAIL`, `MEETING`, `MESSAGE` |
| `intendedNextAction` | Required when scheduled |
| `discussionSummary`, `outcome` | Required when completed |
| `reason` | Required when cancelled or missed |
| `completedBy`, `completedAt` | Completion actor and time |
| `version` | Optimistic concurrency |
| `createdBy`, `createdAt`, `updatedAt` | Traceability |

Overdue is derived from `status = SCHEDULED` and `scheduledAt < now`; it is not
stored. A transfer updates `ownerId` only for scheduled Follow-ups. Completed
records preserve the performer.

## 5. Notes

| Field | Meaning / constraint |
| --- | --- |
| `id`, `leadId` | Note and parent Lead |
| `body` | Required bounded text |
| `authorId`, `createdAt` | Immutable author and time |

Release 1 Notes are append-only. A correction is a new Note that references
the earlier Note; hard deletion is not supported.

## 6. Timeline Entries

| Field | Meaning / constraint |
| --- | --- |
| `id`, `leadId` | Event and Lead |
| `eventType` | Stable business event code |
| `occurredAt` | Business event time |
| `actorId` | User or documented system actor |
| `summary` | User-safe business description |
| `businessData` | Minimal structured values needed to explain the event |
| `correctionOfId` | Optional prior Timeline entry being corrected |
| `commandId` | Links all effects of one command |

Timeline records are immutable and contain no full credential, Note, or contact
snapshots.

## 7. Audit Log

| Field | Meaning / constraint |
| --- | --- |
| `id`, `commandId` | Audit record and originating command |
| `actorId`, `action` | Who and what |
| `targetType`, `targetId` | Affected record |
| `occurredAt` | UTC time |
| `before`, `after` | Allow-listed changed fields only |
| `correlationId` | Request trace |
| `reason` | Required for privileged/terminal actions where applicable |

Audit Log entries are immutable, access-restricted, and excluded from generic
record APIs.

## 8. Notifications

| Field | Meaning / constraint |
| --- | --- |
| `id`, `recipientId` | Notification and receiving User |
| `type` | `LEAD_ASSIGNED` or `LEAD_TRANSFERRED` |
| `leadId` | Business context |
| `message` | Safe display text |
| `createdAt`, `readAt` | UTC lifecycle times |
| `commandId` | Uniqueness/idempotency link |

One recipient/type/command combination creates at most one Notification.

## 9. Idempotency Records

Store actor, operation, idempotency key, canonical request hash, response
reference, status, and expiry. The uniqueness boundary is actor + operation +
key. A reused key with a different request hash is a conflict.

## 10. Transaction Boundaries

The following persist atomically:

- Lead creation and initial history;
- assignment/transfer, history, open Follow-up ownership, and Notification;
- status transition, terminal Follow-up cancellation, and history;
- Follow-up completion, optional next Follow-up, Lead next-action update,
  Timeline, and Audit;
- Note creation and Audit.

Physical retention, encryption, backup, and recovery settings belong to the
deployment/security design.
