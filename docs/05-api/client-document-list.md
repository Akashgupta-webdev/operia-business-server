# Client Document List API

`GET /api/v1/client/documents` requires an authenticated, active `ADMIN`.

| Query | Default | Behavior |
| --- | --- | --- |
| `page` | `1` | Integer at least 1 |
| `limit` | `25` | Integer from 1 to 100 |
| `search` | none | Trimmed string, 1–100 characters; case-insensitive literal partial match on `documentTitle` OR the owning Client's `name` |

Documents are sorted by `createdAt` descending, then `_id` ascending to break ties.
Search is applied before pagination and counting. Unknown query fields and invalid
values return `422 VALIDATION_FAILED`, consistent with other Client lists.

Example: `/api/v1/client/documents?page=1&limit=25&search=passport`.

The response contains `data`, `page: { page, limit, total, totalPages }`, and
`meta: { correlationId }`. Each row includes `id`, `client` (ID), `clientName`,
`service` (ID), `purpose`, `documentTitle`, `documentURL`, `documentType`,
`issueDate`, `expiryDate`, `version`, `createdAt`, and `updatedAt`.
Missing optional values are null. Cloudinary internal identifiers and Client
credentials are excluded. Documents without an owning Client record remain
visible with `clientName: null`.

Empty matches and pages beyond the last page return `200` with `data: []`.
No matches produce `total: 0` and `totalPages: 0`.

## Document KPIs

The response also includes a top-level `kpi` object:

```json
{
  "totalDocuments": 100,
  "expiringIn30Days": 15,
  "expired": 5,
  "validDocuments": 70
}
```

These counts cover all Client Documents, independently of search, page, and
limit. `totalDocuments` includes documents without an expiry date. Expiry dates
use the stored `dd-mm-yyyy` format and the current UTC calendar date, consistent
with dashboard renewal rules. `expired` means before today; `expiringIn30Days`
means today through 30 days from today, inclusive; `validDocuments` means more
than 30 days from today. Missing or unparseable expiry dates count only toward
the total, so the three expiry buckets may not sum to `totalDocuments`.
An empty collection returns zero for all four fields. System status is omitted.
