# Client compliance service membership

All endpoints require an authenticated active ADMIN and use the existing cookie
authentication and response/error envelopes.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/v1/client/compliance/eligible-clients` | Clients with false or missing complianceService |
| GET | `/api/v1/client/compliance/clients` | Clients with complianceService true |
| PATCH | `/api/v1/client/compliance/enrollment` | Set complianceService true |
| PATCH | `/api/v1/client/compliance/withdrawal` | Set complianceService false |

GET requests have no body. Optional query parameters are `page` (integer >= 1,
default 1), `limit` (integer 1-100, default 20), and `search` (trimmed 1-100
characters). Unknown fields are rejected. Search is a literal case-insensitive
partial match on client name or any related company name. Newest clients appear
first, with `_id` ascending as the tie-breaker.

GET success (200):
```js
({
  data: [{ _id: "68ad00000000000000000001", name: "Example Person",
    mobileNumber: "+971501234567", companyName: "Example Trading LLC", nationality: "India" }],
  page: { page: 1, limit: 20, total: 1, totalPages: 1 },
  meta: { correlationId: "opaque-correlation-id" }
});
```
The available-client endpoint returns only those five client fields. Missing values are null. Company
name is from the newest related company, matching the existing client list.
Clients appear once even if multiple companies match. No matches means an empty
array and zero total/totalPages; an out-of-range page returns an empty array.

Both PATCH requests require exactly `{ "_id": "68ad00000000000000000001" }`.
The identifier must be 24 hexadecimal characters. The route fixes the target
boolean; callers cannot supply additional fields. Repeating a command leaves
the client in the requested state. Persistence uses existing Client validation
and optimistic concurrency. Success (200) includes an ETag version header:
```js
({ data: { _id: "68ad00000000000000000001", complianceService: true },
  meta: { correlationId: "opaque-correlation-id" } });
// Removal returns the same shape with complianceService: false.
```

Errors: 401 unauthenticated, 403 forbidden, 422 VALIDATION_FAILED, 404
CLIENT_NOT_FOUND (PATCH), and the shared persistence/internal error responses.

New Clients default to false. Before deployment, run
`node scripts/migrate-client-compliance.js` with MONGODB_URI configured to
backfill missing fields. It preserves explicit booleans and timestamps.
The available list also handles missing fields before migration.

## Added-client filing information

`compliance/clients` additionally returns
`vatTaxRegistrationNumber` from the newest displayed company (null if missing),
`lastFilingDate`, and `nextDueDate`. The two dates are from the same ClientVATFiling
record: the greatest non-null `filingDate` for that client across its companies,
with `_id` descending breaking ties. No filing status filter is applied to this
latest-record lookup. Both fields are null when no dated VAT filing exists.
Dates in this response are ISO 8601 UTC strings.

The top-level `metrics` object contains counts across **all compliance-enabled
clients**, independent of search and pagination:

- `totalTaxFilings`: ClientVATFiling plus ClientTAXFiling records with `status: "paid"`.
- `actionRequired`: records in either collection with status `pending` or `paid`
  and `today < nextDueDate <= today + 15 days`. Today uses the existing UAE
  (Asia/Dubai) calendar date; today and overdue dates are excluded, day 15 is included.
- Cancelled filings and filings for non-enabled or missing clients are excluded.
- Records are counted, not distinct clients. Empty populations return zero.

```js
({
  data: [{
    _id: "68ad00000000000000000001", name: "Example Person",
    mobileNumber: "+971501234567", companyName: "Example Trading LLC", nationality: "India",
    vatTaxRegistrationNumber: "100000000000001",
    lastFilingDate: "2026-10-01T00:00:00.000Z",
    nextDueDate: "2026-10-20T00:00:00.000Z"
  }],
  page: { page: 1, limit: 20, total: 1, totalPages: 1 },
  metrics: { totalTaxFilings: 12, actionRequired: 3 },
  meta: { correlationId: "opaque-correlation-id" }
});
```

## Standalone filing models

### Paginated filing lists

- `GET /api/v1/client/:id/vat-filings?page=1&limit=20`
- `GET /api/v1/client/:id/tax-filings?page=1&limit=20`

Both routes require an authenticated active ADMIN. `id` is the client's
24-character hexadecimal `_id`. Query parameters are optional: `page` defaults
to 1 (integer >= 1); `limit` defaults to 20 (integer 1-100). Unknown query fields
are rejected. Invalid input returns 422; a missing client returns 404
CLIENT_NOT_FOUND. Authentication and role failures return 401 and 403.

Each route returns only its filing collection, scoped to the client across all
companies and statuses. Sort is filingDate descending, then _id descending;
undated filings follow dated filings. The existing filing index supports this order.
Results use the model's JSON representation, including `payableTax`.

Response: `{ data: [filing], page: { page, limit, total, totalPages },
meta: { correlationId } }`. An existing client without filings returns an empty
array and zero totals. An out-of-range page returns an empty array with the
actual total and totalPages. These lists read standalone filings, not ClientService
VAT workflow records.

`ClientVATFiling` (`clientVATFilings`) and `ClientTAXFiling` (`clientTAXFilings`)
share these fields:

| Field | Storage / behavior |
| --- | --- |
| `client` | Required Client ObjectId reference |
| `company` | Required ClientCompany ObjectId reference |
| `input`, `output` | Required Decimal128 amounts, at most 16 whole digits and two decimal places |
| `payableTax` | Read-only virtual decimal string, exactly input minus output; may be negative |
| `filingDate` | Optional Date, allowing a pending record before actual filing |
| `nextDueDate` | Required Date |
| `status` | `draft`, `pending` (default), `submitted`, `paid`, `overdue`, or `rejected` |

Both models include the standard timestamps and optimistic-concurrency version.
Money calculations reuse exact minor-unit arithmetic. Payable tax is calculated
on hydrated documents and included in toJSON/toObject; it is not a stored field
or an aggregation/lean field. Date setters accept the existing dd-mm-yyyy format
or Mongoose Date inputs. Supply date-only values at midnight UTC.

These are new standalone collections; existing ClientService VAT workflow records
are not migrated or included in these metrics. No filing write routes are introduced.
Future write services must verify that the company belongs to the client, as
ObjectId refs alone do not enforce ownership or existence.

Run `node scripts/migrate-client-filing-indexes.js` with MONGODB_URI configured
to create the new collection indexes before deployment. It does not rewrite
existing records.

## Single-client compliance information

`GET /api/v1/client/:id/compliance` requires an active
ADMIN and a valid Client ObjectId. Missing clients return 404 CLIENT_NOT_FOUND;
invalid identifiers return 422 VALIDATION_FAILED.

The response is `{ data, metrics, meta: { correlationId } }`. `data` contains
`_id`, `name`, `nationality`, `mobileNumber`, `emailAddress`, `status`,
`companyName`, `vatTaxRegistrationNumber`, `corporateTaxNumber`, `nextVATDue`,
and `nextTAXDue`. Company fields come from the newest company (createdAt
descending, _id ascending). Missing values, including missing companies, are null.
Client compliance membership does not restrict this administrator detail endpoint.

ClientCompany now stores optional Date fields `complianceDueDate.nextVATDue`
and `complianceDueDate.nextTAXDue`. Supply calendar dates as midnight UTC; the
endpoint returns ISO UTC strings. This change does not add company write API fields.

`metrics.totalFiling` counts VAT and TAX records with status `paid`
for the client across all companies. `metrics.dueSoon` counts the displayed
company's two dates from today through today + 30 days, inclusive.
`metrics.overdue` counts those strictly before today. Today is the UAE calendar
day; absent dates count toward neither metric. Deadline counts range from 0 to 2.

Paid filings are considered complete for both compliance filing totals. Statuses
use the existing lowercase storage convention, with `pending` as the default.
The enum excludes `paic`, `complete`, and `cancelled`. Existing records are not
rewritten; legacy statuses do not count toward totals and must be changed to an
allowed status before saving. No database migration is performed by this change.
