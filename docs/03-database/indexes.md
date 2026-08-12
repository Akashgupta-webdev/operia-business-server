# Release 1 Index Requirements

## 1. Principles

Indexes must support documented authorization-first queries and constraints.
Exact syntax depends on the selected database. Verify all indexes with query
plans and production-like volume; remove redundant indexes because every write
maintains them.

## 2. Uniqueness

| Record | Key | Purpose |
| --- | --- | --- |
| User | normalized `email` | Prevent duplicate identities |
| Notification | `commandId`, `recipientId`, `type` | Prevent retry duplicates |
| Idempotency | `actorId`, `operation`, `key` | Enforce idempotency scope |
| Counter | normalized `name` | Maintain one atomic sequence per counter name |
| Company | `companyId` | Prevent duplicate allocated company identifiers |

Lead phone and email are intentionally non-unique because duplicate detection
warns but does not silently block or merge valid separate opportunities.

## 3. Lead Query Indexes

| Ordered fields | Supports |
| --- | --- |
| `ownerId`, `status`, `nextFollowUpAt`, `id` | Agent workload and status filters |
| `status`, `ownerId`, `updatedAt`, `id` | Admin workload and stable pagination |
| `source`, `createdAt`, `id` | Source/date filtering |
| `normalizedPhone` | Duplicate candidate lookup |
| `normalizedEmail` | Duplicate candidate lookup |

If partial/filtered indexes are supported, exclude null normalized contact
values and optionally limit workload indexes to non-terminal statuses.

## 4. Follow-up Indexes

| Ordered fields | Supports |
| --- | --- |
| `ownerId`, `status`, `scheduledAt`, `id` | Agent due/overdue queue |
| `leadId`, `scheduledAt`, `id` | Lead Follow-up history |
| `leadId`, `status`, `scheduledAt`, `id` | Earliest scheduled Follow-up |

## 5. Company Indexes

| Ordered fields | Supports |
| --- | --- |
| `client`, `createdAt`, `companyId` | Paginated Company lookup for one Client |

## 6. History and Notification Indexes

| Record | Ordered fields | Supports |
| --- | --- | --- |
| Timeline | `leadId`, `occurredAt`, `id` | Stable chronological Lead Timeline |
| Audit | `targetType`, `targetId`, `occurredAt`, `id` | Investigation by record |
| Audit | `actorId`, `occurredAt`, `id` | Investigation by actor |
| Notification | `recipientId`, `readAt`, `createdAt`, `id` | User inbox/unread queue |

Append-only history should use time-sortable access without relying on timestamp
alone; `id` is the deterministic tie-breaker.

## 7. Search

Do not use an unconstrained full-collection regular expression for Lead search.
Use database-supported text/search indexing or a normalized bounded search
projection. Search results must still apply owner authorization before
pagination and must not expose inaccessible duplicate candidates.

## 8. Verification

Integration tests must verify uniqueness conflicts and query behavior. Before
release, capture query plans for Agent workload, Admin filters, duplicate
detection, Timeline, overdue Follow-ups, and unread Notifications.
