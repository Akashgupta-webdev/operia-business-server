# VAT filing — standalone frontend implementation handoff

This file is intended to be copied into a DIFFERENT frontend repository and given
to its Codex chat. It contains the implementation context and backend contracts;
no prior conversation or backend source checkout is needed.

Verified against the backend routes, validators, services and schemas on
2026-09-23. This document describes the implemented contract, not a proposed API.
Frontend routes, component names and layouts below are recommendations; adapt them
to the frontend's existing framework, design system, routing and data-fetching stack.

## 1. Instructions for the frontend coding agent

1. Inspect the frontend's AGENTS.md, package.json, routing, authentication, API
   client, existing Client pages, forms, dialogs and table components.
2. Reuse those conventions. Do not introduce a new framework or UI library solely
   for this feature. Do not assume React, Next.js, Vue, Axios or any query library.
3. Implement an ADMIN-only VAT workspace and a VAT section on Client detail.
4. Use the real backend contracts in this file. Keep fixtures confined to tests
   and development previews; never silently substitute mock data for API failures.
5. Keep API transport, DTO normalization, form validation, state/action rules and
   screen components separate.
6. Implement loading, empty, error, expired-session, stale-version, upload-failure
   and duplicate-period states, not just the successful path.
7. Do not create backend changes in the frontend folder. Explicitly report backend
   capabilities missing from this handoff instead of inventing endpoints.
8. Finish with relevant frontend tests and the project's build/type checks.
9. Show all user-facing monetary values as AED, with the precision rules below.

### Product scope

Staff manage the work involved in filing VAT for a UAE company. One filing is one
company tax registration and one explicit period. Repeated periods have separate
service records linked through previousService.

The accountant prepares the actual return outside this application. The frontend
collects records, records reviewed VAT totals, routes review and client approval,
records a manual EmaraTax submission, and records VAT settlement evidence.

Use labels such as **Record submission** and **Record client approval**. These
actions do not submit a tax return or send an approval request to the client.
Client approval is recorded by an Admin, with evidence of the external approval.

The current release supports standalone company registrations. It does not support
VAT groups, an automated tax engine, government submission integration, client
portal approvals, outbound notifications, refunds, or amendments to filed returns.
Legacy records whose package label mentions VAT but which lack serviceCode
VAT_RETURN_FILING are not new-workflow filings and must not be auto-converted.

### Three independent indicators

| UI indicator | Source | Meaning |
| --- | --- | --- |
| Filing progress | service.status + details.vat.stage | Operational progress |
| Our service fee | packagePrice + paymentStatus | Customer payment to this business |
| VAT settlement | details.vat.calculation + details.vat.settlement | Customer tax owed/paid to the authority |

A filed service can still have an unpaid service fee AND unpaid tax. Do not merge
these indicators or infer payment from service.status = Completed.
Show missing fee/payment values as "Not recorded", not zero or paid.

## 2. Connection, permissions and reference data

### API base and authentication

Configure the backend API base through the frontend's existing environment setup,
for example API_BASE = https://backend.example.com/api/v1.
All endpoint paths below include /api/v1; avoid adding that prefix twice.

Authentication uses existing HTTP-only cookies. Browser requests need
credentials: "include" (Axios equivalent: withCredentials: true).
Do not read/store cookies or construct a Bearer token for these routes.
Reuse the staff login/session flow. The staff session endpoints are:
GET /api/v1/auth/session and GET /api/v1/me.
The separate /api/v1/login and /api/v1/session endpoints are CLIENT authentication;
do not use them for staff VAT access.

The authenticated user must have role ADMIN and status ACTIVE. Hide navigation
and guard frontend routes accordingly; server authorization remains authoritative.
An AGENT cannot access this feature, even if a UI happens to contain its link.

For a separate browser origin, the backend must allow the frontend origin in
ALLOWED_ORIGIN or ALLOWED_ORIGIN_CLIENT with credentialed CORS. ETag and
X-Correlation-Id are exposed by the backend. Use service.version from JSON as the
primary concurrency token, so the UI does not depend on parsing ETag.

### Client and company selectors

- On an existing Client page, use GET /api/v1/client/{clientId}.
  Response data contains client, companies, services, documents, reminders and
  other related arrays. Use data.companies for this Client's company choices.
- On a global create flow, GET /api/v1/client/companies supports page (default 1),
  limit (default 20, max 100), search (company name, 1-100 characters).
  This endpoint does NOT accept a client filter.
- Company list rows include id, client (owning Client ID), companyName,
  vatTaxRegistrationNumber and clientName. Optional values may be null.
- Company pagination is {page: {page, limit, total, totalPages}}.
  It differs from VAT pagination; do not share an incompatible DTO.
- Use the selected row's client for the creation URL and id for body.company.
  Company IDs and Client IDs are different.
- Require a 15-digit TRN on the selected company before allowing VAT creation.
  Do not put TRN in the filing request; the server snapshots company master data.
- Existing company edit is PATCH /api/v1/client/{clientId}/company with, for example,
  {"vatTaxRegistrationNumber":"100000000000001"}. It identifies the Client, not a
  company ID. Its backend currently selects one company for that Client with
  findOne. If a Client has multiple companies, do not use it as a company-specific
  VAT quick fix; require the master-data ambiguity to be resolved.
- For display, resolve service.client and service.company through reference data.
  VAT list/detail responses do not populate names. Do not fetch the full detail
  of every Client for each table row; reuse existing caches and paginated lookups.
  An ID fallback is acceptable when a name cannot yet be resolved.

### Assignee selection: known dependency

The VAT API accepts only active ADMIN user IDs. The inspected backend does NOT
currently implement a staff-directory/list-users API, despite older planning
documentation mentioning /api/v1/users.

Reuse a verified Admin-directory source if the frontend already has one. Otherwise
omit optional assignedTo on creation and offer "Assign to me" using the signed-in
Admin's real ID. For arbitrary reassignment, show that Admin lookup support is
required; do not fabricate users, submit names as IDs, or call an assumed endpoint.
Existing actor/assignee references may need an ID fallback for their display name.

## 3. Complete HTTP contract

The following section is included in full so this file stands alone.


All endpoints require the existing authentication cookies and an active ADMIN.
These APIs record manually prepared and submitted UAE returns. They do not submit
to EmaraTax, store government credentials, calculate deadlines, or prepare VAT201.

### Create a filing

`POST /api/v1/client/{clientId}/service`

```json
{
  "serviceCode": "VAT_RETURN_FILING",
  "category": "Tax & Accounting",
  "package": "Quarterly VAT Return Filing Package",
  "company": "68ad00000000000000000001",
  "status": "Pending",
  "packagePrice": "500.00",
  "paymentStatus": "Unpaid",
  "dueDate": "28-07-2026",
  "details": {
    "vat": {
      "periodStart": "01-04-2026",
      "periodEnd": "30-06-2026"
    }
  }
}
```

Optional assignedTo must identify an active ADMIN. Company ownership and its
15-digit TRN are validated. The server snapshots the TRN. A duplicate TRN and
period returns 409 VAT_PERIOD_EXISTS. This release supports standalone company
registrations; VAT groups need a future shared tax-registration model.

Response: 201 with the existing `{data: service, meta}` envelope and ETag.
Creation starts at AWAITING_DOCUMENTS. No approval/stage/TRN/history fields may be
provided. Aggregate Client creation accepts the same VAT service body but omits
company; the server uses the company created in that transaction. Existing
package-only legacy services retain their old behavior and are not auto-converted.

### Read

- `GET /api/v1/client/services`: VAT-only listing, default page 1 / limit 25,
  maximum limit 100. Optional filters: serviceCode=VAT_RETURN_FILING, client,
  company, assignedTo, status, stage, fromDate, toDate. Date filters apply to
  statutory dueDate inclusively. Sort: dueDate then _id.
- `GET /api/v1/client/service/{id}`: VAT detail with
  `{data: {service, documents, reminder}, meta}`. Non-VAT IDs return 404.
- Existing Client detail also includes all services, documents and reminders.

List response: `{data: [...], page: {number, limit, hasMore}, meta}`.
Input calendar dates use dd-mm-yyyy. New stored Date fields serialize as ISO UTC
midnight; treat them as calendar dates rather than converting to local time.
Decimal128 fields follow the existing money representation:
`{"$numberDecimal": "500.05"}`. Do not parse these as floating-point for arithmetic.

### Upload filing evidence

Use existing `POST /api/v1/client/{clientId}/document` multipart upload with
binary field `documents` and these additional metadata fields:

| Field | Meaning |
| --- | --- |
| service | VAT ClientService ID owned by this Client |
| purpose | SOURCE, WORKING_PAPER, APPROVAL, ACKNOWLEDGMENT, TAX_PAYMENT |

purpose is required when service is supplied and forbidden otherwise.
Existing title/type/date fields still work. Upload returns the new Document ID.
Service-linked evidence cannot be deleted, even before submission; replacement
files get new IDs and the workflow records which IDs were used. There is no new
client-portal access in this release.

### Business actions

All use `POST /api/v1/client/service/{id}/vat/{action}`.
Every body requires integer expectedVersion, taken from service.version or ETag.
Unknown fields are rejected. Every action returns
`{data: {service}, meta}` with the updated ETag; create-next-period returns 201
with `{data: {service, nextService}, meta}`.

| Action | Additional body fields |
| --- | --- |
| prepare | outputVat, recoverableInputVat (signed decimal strings), workingPaper (Document ID), sourceDocuments (1-100 unique Document IDs) |
| request-review | None |
| approve-review | None; records the internal reviewer |
| record-approval | approverName, document (APPROVAL evidence) |
| return-for-correction | reason |
| record-submission | reference, submittedOn, document (ACKNOWLEDGMENT evidence) |
| record-tax-payment | amountPaid (cumulative decimal string), paidOn, document (TAX_PAYMENT evidence), reason required when replacing an existing recorded payment |
| revise-period | periodStart, periodEnd, dueDate, reason |
| cancel | reason |
| reopen | None |
| assign | assignedTo (active ADMIN ID) |
| schedule-reminder | followupDate, optional notes array |
| complete-reminder | None |
| create-next-period | periodStart, periodEnd, dueDate |

Example preparation:

```json
{
  "expectedVersion": 0,
  "outputVat": "1000.10",
  "recoverableInputVat": "500.05",
  "workingPaper": "68ad00000000000000000002",
  "sourceDocuments": ["68ad00000000000000000003"]
}
```

The server derives netVat exactly as reviewed outputVat minus reviewed
recoverableInputVat. These are accountant-prepared totals including relevant
adjustments, not a full tax calculation engine. Inputs allow up to 15 integer
digits and two decimals. Net tax and cumulative payment allow 16 integer digits.
Amounts are AED. Zero net tax becomes NOT_DUE; a negative position becomes CREDIT.

Advance preparation through request-review, approve-review, record-approval and
record-submission. Read the returned version before each action. Submission needs
an approved current revision and sets service status Completed. Service fee
paymentStatus remains independent. Positive VAT settlement remains UNPAID until
record-tax-payment changes it to PARTIAL or PAID. Payment must not exceed net VAT.

Submission/payment dates cannot be in the future or before period end. Filed
return data cannot be changed. Next-period creation requires a filed predecessor,
explicit dates after its period, and a current version. Fees/payment are not copied.
Duplicate successor creation is blocked by a database unique index.

Reminders are internal tasks, not outbound notifications. Scheduling updates the
one current service reminder; action history retains prior schedule details.
Filing/cancellation cancels pending reminders within the same transaction.

### Generic service PATCH and DELETE

VAT PATCH only accepts packagePrice, paymentStatus, targetCompletionDate and notes,
plus required expectedVersion. Filing identity/period/status cannot be set through
generic PATCH. Fee and administrative edits remain possible after filing.
DELETE of VAT services returns 409 VAT_HISTORY_RETAINED; use cancel before filing.

### Conflicts and errors

| HTTP / code | Meaning |
| --- | --- |
| 401 / AUTHENTICATION_REQUIRED or INVALID_CREDENTIALS | Authentication missing/invalid or User inactive |
| 403 / FORBIDDEN | Active User is not an Admin |
| 404 / CLIENT_SERVICE_NOT_FOUND | VAT filing does not exist |
| 422 / VALIDATION_FAILED | Invalid dates, amounts, company, assignee or request shape |
| 422 / INVALID_TRANSITION | Action not permitted in current stage |
| 422 / VAT_EVIDENCE_REQUIRED | Evidence missing, wrong purpose, or wrong filing/client |
| 422 / VAT_REVIEW_REQUIRED or VAT_APPROVAL_REQUIRED | Current revision lacks required review/approval |
| 409 / VERSION_CONFLICT | Stale or missing version; reload before retrying |
| 409 / VAT_PERIOD_EXISTS | Duplicate TRN/period or successor |
| 409 / VAT_ACTION_REQUIRED | Generic PATCH tried to change the workflow |
| 409 / VAT_FILED_LOCKED | Attempt to change filed return data |
| 409 / VAT_HISTORY_RETAINED | Attempt to delete a filing or linked document |

Versioned commands reject replay rather than silently applying twice. After a
lost response, reload the filing/history; do not blindly repeat with a new version.
This is the explicit Client contract, not the future Lead idempotency-key contract.

### Deployment and verification

A MongoDB replica set is required for action transactions.
Run `npm run migrate:vat` with the deployment MONGODB_URI before enabling VAT writes.
It creates indexes without dropping unrelated ones or modifying legacy records.
The migration has not been executed against your database by this implementation.

Run `npm run test:vat` for unit and HTTP contract tests.
Run `npm run test:vat:integration` with VAT_TEST_MONGODB_URI pointing to a dedicated
local replica set for real uniqueness, concurrent writes, rollback and recurrence.
The integration suite creates and removes only its generated vat_test_* database.


## 4. DTOs and response handling

The following TypeScript describes the important wire fields. It is a reference
even if the frontend uses JavaScript. Top-level resources serialize their ID as
id; references serialize as ID strings. Optional fields may be omitted. Fee/admin
fields cleared through PATCH may be null. Keep unknown additional response fields
forward-compatible; only write explicitly allowed request fields.

```ts
type Id = string; // 24-character hexadecimal MongoDB ID for VAT resource inputs
type Decimal128Json = { $numberDecimal: string };
type IsoDateOnly = string; // e.g. "2026-06-30T00:00:00.000Z"
type ClientDate = string; // e.g. "30-06-2026"
type Timestamp = string; // true ISO timestamp, e.g. recordedAt
type VatStage =
  | "AWAITING_DOCUMENTS" | "PREPARING" | "INTERNAL_REVIEW"
  | "AWAITING_CLIENT_APPROVAL" | "READY_TO_FILE" | "FILED";
type ServiceStatus = "Pending" | "In Progress" | "Completed" | "Cancelled";
type FeeStatus = "Unpaid" | "Partial" | "Paid";
type TaxStatus = "UNPAID" | "PARTIAL" | "PAID" | "NOT_DUE" | "CREDIT";
type DocumentPurpose =
  | "SOURCE" | "WORKING_PAPER" | "APPROVAL" | "ACKNOWLEDGMENT" | "TAX_PAYMENT";

interface VatCalculation {
  outputVat: Decimal128Json;
  recoverableInputVat: Decimal128Json;
  netVat: Decimal128Json;
  workingPaper: Id;
  sourceDocuments: Id[];
}
interface VatApproval {
  name: string;
  document: Id;
  revision: number;
  recordedBy: string;
  recordedAt: Timestamp;
}
interface VatHistoryEvent {
  action: string;
  actor: string;
  at: Timestamp;
  revision: number;
  reason?: string;
  reference?: string;
  document?: Id;
  amount?: Decimal128Json;
  calculation?: VatCalculation;
  approval?: VatApproval;
  periodStart?: IsoDateOnly;
  periodEnd?: IsoDateOnly;
  dueDate?: IsoDateOnly;
  scheduledFor?: IsoDateOnly;
  notes?: string[];
  assignedTo?: Id;
}
interface VatService {
  id: Id;
  client: Id;
  company: Id;
  serviceCode: "VAT_RETURN_FILING";
  category: "Tax & Accounting";
  package: "Quarterly VAT Return Filing Package";
  status: ServiceStatus;
  version: number; // concurrency version; NOT calculation revision
  assignedTo?: Id;
  previousService?: Id;
  dueDate: IsoDateOnly;
  targetCompletionDate?: ClientDate | null; // legacy string format
  packagePrice?: Decimal128Json | null;
  paymentStatus?: FeeStatus | null;
  notes?: string[] | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  details: {
    vat: {
      trn: string;
      country: "AE";
      periodStart: IsoDateOnly;
      periodEnd: IsoDateOnly;
      stage: VatStage;
      revision: number; // calculation/period revision
      calculation?: VatCalculation;
      review?: { actor: string; at: Timestamp; revision: number };
      approval?: VatApproval;
      submission?: {
        reference: string;
        submittedOn: IsoDateOnly;
        acknowledgment: Id;
        recordedBy: string;
        recordedAt: Timestamp;
      };
      settlement?: {
        status: TaxStatus;
        amountPaid: Decimal128Json;
        paidOn?: IsoDateOnly;
        document?: Id;
      };
      history: VatHistoryEvent[];
    };
  };
}
interface VatDocument {
  id: Id;
  client: Id;
  service: Id;
  purpose: DocumentPurpose;
  documentTitle?: string;
  documentType?: "Passport" | "Emirates ID" | "Visa" | "Trade Licence" | "Other";
  documentURL?: string;
  issueDate?: ClientDate;
  expiryDate?: ClientDate;
  version?: number;
  createdAt?: Timestamp;
}
interface VatReminder {
  id: Id;
  client: Id;
  service: Id;
  state: "PENDING" | "COMPLETED" | "CANCELLED";
  followupDate: ClientDate;
  scheduledFor: IsoDateOnly;
  completedAt?: Timestamp;
  notes?: string[];
  priority?: "Low" | "Normal" | "High";
  remindBefore?: string; // legacy metadata; not proof of notification delivery
}
interface VatDetail {
  service: VatService;
  documents: VatDocument[];
  reminder: VatReminder | null;
}
interface Envelope<T> {
  data: T;
  meta: { correlationId: string };
}
interface VatListResponse extends Envelope<VatService[]> {
  page: { number: number; limit: number; hasMore: boolean };
}
interface VatActionResult {
  service: VatService;
  nextService?: VatService; // only create-next-period
}
interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details: Array<{ field: string; issue: string }>;
  };
  meta: { correlationId: string };
}
```

### Do not confuse response shapes

| Request | Service/document location in JSON |
| --- | --- |
| Create service | result.data |
| Generic PATCH service | result.data |
| VAT action | result.data.service |
| Create next period | result.data.service = predecessor; result.data.nextService = new filing |
| VAT detail GET | result.data.service, result.data.documents, result.data.reminder |
| VAT list GET | result.data array; result.page.number/limit/hasMore |
| Upload document | result.data (new document; use result.data.id) |
| Client detail GET | result.data.services / companies / documents / reminders |

Do not assume all responses can be read with result.data.service.
Actions do not return refreshed documents/reminder. Refetch detail after successful
actions; this is essential after scheduling, completion, cancellation and filing.
Creation does not support attachment upload in the same service request.

### Example detail response

Illustrative PREPARING response generated using the actual model serialization.
For readability, document and history arrays are empty in this example; a real
prepared filing includes its referenced documents and preparation event.

```json
{
  "data": {
    "service": {
      "client": "68ad00000000000000000011",
      "company": "68ad00000000000000000001",
      "serviceCode": "VAT_RETURN_FILING",
      "dueDate": "2026-07-28T00:00:00.000Z",
      "details": {
        "vat": {
          "trn": "100000000000001",
          "country": "AE",
          "periodStart": "2026-04-01T00:00:00.000Z",
          "periodEnd": "2026-06-30T00:00:00.000Z",
          "stage": "PREPARING",
          "revision": 1,
          "calculation": {
            "outputVat": {
              "$numberDecimal": "1000.10"
            },
            "recoverableInputVat": {
              "$numberDecimal": "500.05"
            },
            "netVat": {
              "$numberDecimal": "500.05"
            },
            "workingPaper": "68ad00000000000000000002",
            "sourceDocuments": [
              "68ad00000000000000000003"
            ]
          },
          "settlement": {
            "status": "UNPAID",
            "amountPaid": {
              "$numberDecimal": "0.00"
            }
          },
          "history": []
        }
      },
      "category": "Tax & Accounting",
      "package": "Quarterly VAT Return Filing Package",
      "status": "In Progress",
      "packagePrice": {
        "$numberDecimal": "500.00"
      },
      "paymentStatus": "Unpaid",
      "createdAt": "2026-07-01T09:00:00.000Z",
      "updatedAt": "2026-07-01T09:10:00.000Z",
      "version": 1,
      "id": "68ad00000000000000000010"
    },
    "documents": [],
    "reminder": null
  },
  "meta": {
    "correlationId": "example-correlation-id"
  }
}
```

## 5. Recommended UI and navigation

Use the existing app navigation and design system. Suggested routes are frontend
routes only, not new API endpoints:

- /vat-filings — global work queue.
- /vat-filings/new — create for selected Client/company.
- /vat-filings/:serviceId — detail and work actions.
- Existing Client detail -> Services -> VAT filings, prefiltered by Client.

### List / work queue

Display company, Client, TRN, period, statutory due date, filing stage, service
status, assignee, tax settlement and a link to detail. Keep tax amount separate
from service fee. If space is limited, put financial details on the detail screen.

Filters: Client/company/assignee IDs, stage, service status, due-date range.
Reset page to 1 when filters change. Omit blank query fields.
Persist filters in the URL if that matches existing app conventions.
Use Previous/Next pagination: no total count or totalPages is returned.
Default API sort is dueDate ascending then ID; arbitrary server sorting and text
search are not supported. Do not add query keys such as search, sort or overdue.
Do not filter only the current page and present it as a global search.

Overdue is a derived badge: due date before today's Dubai date and status not
Completed/Cancelled. Due today is not overdue. A completed filing can still show
unpaid tax; this is a separate settlement indicator.

### Create form

Select Client/company; show the company's current TRN read-only. Inputs:
period start, period end, statutory deadline, optional active Admin assignee,
service fee, fee payment state, internal target and notes.

Always send serviceCode/category/package constants exactly as documented.
The package label says "Quarterly" for compatibility; do not force quarter dates
or infer dates from that label. Read the actual period/deadline from the user's
EmaraTax record. Keep statutory due date visually separate from internal target.

On 201, navigate using result.data.id to detail. Upload supporting files there.
On a lost create response, search/list the company and period before retrying.
On duplicate-period conflict, help the user find the existing filing, including
Cancelled records; cancellation does not release the period for recreation.

### Detail workspace

Recommended sections/tabs:

1. Summary: company, TRN snapshot, period, due date, assignee, stage, service status.
2. Documents: grouped by purpose; upload and open retained files.
3. Preparation: reviewed totals, working paper and source selection.
4. Review and approval: internal review status, client approver and evidence.
5. Submission: external reference, submission date, acknowledgment.
6. Tax settlement: net payable/credit, cumulative paid amount, balance and evidence.
7. Service fee: fee amount and fee payment state, separate from tax settlement.
8. Reminder and notes.
9. History: actor/action/time/revision/reason, referenced evidence and available
   calculation/approval snapshots; link previousService to predecessor detail.

History covers VAT actions. It is not a complete audit of every upload or generic
fee edit. Do not synthesize nonexistent audit events. Avoid dumping JSON on users.
Show each action's meaningful fields and a readable action label.

### Primary action matrix

Cancelled status takes precedence over the stored VAT stage. The stage can remain
READY_TO_FILE or another previous value after cancellation, but approval is cleared.
Show a prominent Cancelled label and Reopen; do not expose normal workflow actions.

| Current condition | Suggested primary action | Result |
| --- | --- | --- |
| AWAITING_DOCUMENTS, active | Upload sources / Save preparation | PREPARING once preparation succeeds |
| PREPARING, calculation exists | Request review | INTERNAL_REVIEW |
| PREPARING, no calculation (e.g. revised period) | Save preparation | PREPARING with new calculation |
| INTERNAL_REVIEW | Approve review | AWAITING_CLIENT_APPROVAL |
| AWAITING_CLIENT_APPROVAL | Record client approval | READY_TO_FILE |
| READY_TO_FILE | Record submission | FILED, service Completed |
| FILED, positive net VAT | Record/update VAT payment | PARTIAL / PAID / UNPAID independently |
| FILED | Create next period | Separate new Pending filing |
| Cancelled | Reopen | PREPARING, service In Progress |

Additional backend-supported rules:

- prepare can replace the calculation in ANY active, unfiled stage. Explain that
  saving it increments calculation revision, clears review/approval, resets
  settlement and returns to PREPARING. Disable accidental double-submit.
- return-for-correction and revise-period are available before filing and require
  a reason. Correction clears review/approval but retains the calculation;
  revise-period clears calculation AND settlement as well.
- cancel is available before filing with a reason; use a confirmation dialog.
- assign, schedule-reminder and complete-reminder are available on active,
  unfiled records; complete-reminder also needs an actual PENDING reminder.
- assign additionally works on FILED records. It does not work while Cancelled.
- On FILED records, the only VAT actions accepted are record-tax-payment,
  create-next-period and assign. No new reminder or completion action is accepted.
- Generic fee/admin PATCH and document upload remain available on Filed or
  Cancelled services. These do not unlock the tax return.
- The backend does not require different users for preparation and internal review;
  do not imply enforced segregation of duties.
- There is no allowedActions field. Keep these guards in one frontend helper;
  always handle server conflicts if the state changes after rendering.

## 6. Forms, validation and examples

All resource IDs sent to VAT endpoints must be 24 hexadecimal characters.
Send ONLY allow-listed fields. Do not spread a full service DTO into a write body.

### Shared validation

- expectedVersion: current integer service.version, zero or greater.
- Dates: real dd-mm-yyyy dates, years 1900-9999; start <= end < dueDate.
- Current filing's company/TRN are not editable through filing actions.
- Signed preparation amount strings: up to 15 integer digits, 0-2 decimals,
  no commas, exponent notation or leading plus. Negative amounts are accepted.
- Non-negative cumulative payment string: up to 16 integer digits, 0-2 decimals.
- Fee packagePrice: non-negative decimal string with up to two decimals.
- reference and approverName: trimmed nonempty strings, maximum 200 characters.
- reason: trimmed nonempty string, maximum 1,000 characters.
- notes: at most 100 nonempty trimmed strings, maximum 1,000 characters each.
- sourceDocuments: 1-100 unique document IDs belonging to this service, purpose SOURCE.
- workingPaper must reference a WORKING_PAPER document for this filing.
- Submission and payment dates must be >= periodEnd and <= today's Dubai date.
  Payment date is not required by the API to be after submission date.
- Next period start must be > predecessor period end. The new period and deadline
  must also satisfy normal ordering. A predecessor can have only one successor.

### Action payload examples

Every JSON object below is a complete body. Versions are illustrative placeholders;
use the actual loaded version. Never hard-code these numbers.

Request review / approve review / reopen / complete reminder:
```json
{ "expectedVersion": 2 }
```

Record client approval:
```json
{
  "expectedVersion": 3,
  "approverName": "Example Client Signatory",
  "document": "68ad00000000000000000004"
}
```

Record manual submission:
```json
{
  "expectedVersion": 4,
  "reference": "FTA-RETURN-EXAMPLE",
  "submittedOn": "20-07-2026",
  "document": "68ad00000000000000000005"
}
```

Record/update tax payment:
```json
{
  "expectedVersion": 5,
  "amountPaid": "500.05",
  "paidOn": "20-07-2026",
  "document": "68ad00000000000000000006",
  "reason": "Cumulative amount reconciled with payment evidence"
}
```

amountPaid REPLACES the cumulative paid amount; it is not an additional payment.
Label the input "Total VAT paid to date". A replacement requires reason whenever
settlement.document already exists, even if the amount increases.
Only FILED returns with positive net VAT accept payments. The amount may be zero
and must not exceed netVat. There is no separate payment ledger, automatic bank
reconciliation, refund request or credit settlement API.

Return for correction / cancel:
```json
{ "expectedVersion": 2, "reason": "Client requested a review of source records" }
```

Revise period:
```json
{
  "expectedVersion": 2,
  "periodStart": "01-05-2026",
  "periodEnd": "31-07-2026",
  "dueDate": "28-08-2026",
  "reason": "Corrected to the period shown in EmaraTax"
}
```

Create next period:
```json
{
  "expectedVersion": 6,
  "periodStart": "01-07-2026",
  "periodEnd": "30-09-2026",
  "dueDate": "28-10-2026"
}
```

The new service starts fresh without prior calculation, evidence, fees or payment.
The company and existing assignee are reused, but the current company TRN is read
again. An inactive existing assignee can prevent successor creation; reassign the
predecessor to an active Admin first. Navigate to data.nextService.id on success.
There is no nextService link field on a previously loaded predecessor; find its
successor from listed records' previousService or handle duplicate-successor 409.

Assign:
```json
{ "expectedVersion": 2, "assignedTo": "68ad00000000000000000007" }
```

Schedule/reschedule reminder:
```json
{
  "expectedVersion": 2,
  "followupDate": "21-07-2026",
  "notes": ["Follow up for missing sales records"]
}
```

There is one current reminder. This schedules an internal task only. The endpoint
does not accept remindBefore, priority, timezone, email or WhatsApp options.
Its date is the task's actual follow-up date; do not subtract legacy remindBefore
metadata to invent a delivery time. The API allows past dates for overdue tasks.
Omitting notes replaces them with an empty array.

Generic fee/admin edit:
```json
{
  "expectedVersion": 2,
  "packagePrice": "500.00",
  "paymentStatus": "Partial",
  "targetCompletionDate": "20-07-2026",
  "notes": ["Waiting for an internal reconciliation"]
}
```

Use PATCH /api/v1/client/service/{id}. These four optional editable fields accept
null to clear a value. Send at least one actual change plus expectedVersion.
Do not send stage, status, company, details, dueDate, assignedTo or period fields.

## 7. Documents and upload interaction

Create the service before uploading. Upload each file separately using the exact
field name documents (plural) even though the endpoint takes ONE file.
Maximum size is 10 MiB per file. The middleware does not declare an extension
allow-list; do not present a frontend-only file restriction as a backend requirement.
Any product-specific file-type policy should be explicitly agreed separately.

```ts
async function uploadVatEvidence(
  apiBase: string,
  clientId: string,
  serviceId: string,
  purpose: DocumentPurpose,
  file: File,
) {
  const form = new FormData();
  form.append("documents", file);
  form.append("service", serviceId);
  form.append("purpose", purpose);
  form.append("documentType", "Other");
  form.append("documentTitle", file.name.slice(0, 200));
  const response = await fetch(
    apiBase.replace(/\/$/, "") + "/client/" + clientId + "/document",
    { method: "POST", credentials: "include", body: form },
  );
  const payload = await response.json();
  if (!response.ok) throw payload;
  return payload.data as VatDocument;
}
```

Do not set Content-Type manually for FormData; the browser sets its boundary.
There is no expectedVersion field on uploads.
Save the returned ID, refetch documents and preselect it in the relevant form.
Opening evidence uses documentURL, not a constructed Cloudinary URL.
Cloudinary private identifiers are not included in the DTO.

An uploaded file is not automatically used as the working paper or approval;
the next workflow request must reference its ID. Filter each document selector by
purpose and by the current service ID. Never allow another filing's documents.

If upload succeeds but the following action fails, retain the uploaded document
and retry the action after resolving its error. Do not automatically delete or
re-upload it. There is no deletion or replacement-in-place for service evidence.
Warn users before upload that files are retained. A replacement is a new upload.

## 8. Dates and decimal handling

### Calendar dates versus timestamps

For periodStart/periodEnd/dueDate/submittedOn/paidOn/scheduledFor, response ISO
midnight represents a calendar date. Avoid new Date(value).toLocaleDateString()
without an explicit date-only policy: it can display the previous day in some
timezones. Use the YYYY-MM-DD prefix and format its components.

Input controls may use YYYY-MM-DD internally; convert to dd-mm-yyyy on submit.
targetCompletionDate and reminder.followupDate are already dd-mm-yyyy strings.
createdAt, updatedAt, history.at, recordedAt and completedAt are true timestamps
and can be shown with the app's normal timestamp display policy.

```ts
function inputDateToApi(value: string): string {
  // Validate a real calendar date before calling.
  const [year, month, day] = value.split("-");
  return [day, month, year].join("-");
}
function apiDateToInput(value: string): string {
  const [day, month, year] = value.split("-");
  return [year, month, day].join("-");
}
function persistedDateToInput(value: string): string {
  return value.slice(0, 10);
}
function dubaiTodayInput(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const pick = (kind: string) => parts.find(part => part.type === kind)!.value;
  return [pick("year"), pick("month"), pick("day")].join("-");
}
```

ISO YYYY-MM-DD strings can be compared lexicographically after real-date
validation. Never sort or compare dd-mm-yyyy strings directly.
No deadline calculator should silently overwrite the user-entered FTA deadline.

### Money

Keep editable amounts as strings throughout the form and request.
Normalize Decimal128 JSON once in the API adapter:
value.$numberDecimal -> decimal string. Preserve missing values as undefined/null.

Use the project's decimal library or exact integer minor units for previews,
remaining-balance calculations and comparisons; do not use parseFloat subtraction.
The server's returned netVat and settlement.status are authoritative.
Zero net tax shows "No VAT payment due"; negative net tax shows "VAT credit",
not "Refund paid". A draft without a calculation has no known tax position yet.

## 9. Mutation handling, caching and errors

### Version control

Use the version from the service snapshot the user actually edited.
Do not fetch a new version just before saving and attach it to an old form;
that hides conflicts and can overwrite newer work.

- One in-flight mutation per filing; disable relevant buttons while pending.
- Workflow actions and generic PATCH require expectedVersion in the JSON body.
  If-Match alone is not a substitute.
- Use the version returned by the server; do not locally increment it.
- Every VAT action can change service.version, including reminders and assignment.
  calculation revision changes only when a calculation/period is revised.
- Upload is a separate mutation and does not increment service.version.
- Prefer confirmed server responses over optimistic status/payment changes.
- On success, invalidate/refetch filing detail, affected list queries, Client
  detail if cached, and dashboard data. For recurrence, refresh the predecessor
  and load the returned new filing.

### API transport reference

Adapt this to the existing frontend API client; do not add a parallel auth stack.

```ts
async function vatJsonRequest<T>(
  apiBase: string,
  path: string,
  method: "GET" | "POST" | "PATCH" = "GET",
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(apiBase.replace(/\/$/, "") + path, {
    method,
    credentials: "include",
    signal,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(new Error(payload.error?.message ?? "Request failed"), {
      status: response.status,
      code: payload.error?.code,
      details: payload.error?.details ?? [],
      correlationId: payload.meta?.correlationId,
    });
  }
  return payload as T;
}
// apiBase already includes /api/v1.
// const result = await vatJsonRequest<Envelope<VatActionResult>>(
//   apiBase, "/client/service/" + service.id + "/vat/request-review", "POST",
//   { expectedVersion: service.version },
// );
```

Production code should also distinguish network failures, aborted reads and
non-JSON upstream responses using the existing transport conventions.
Cancel obsolete list GETs to prevent an earlier filter response replacing newer
results. Do not automatically retry POST/PATCH/upload on timeout or reconnect.

### Error UX

| Situation | Frontend behavior |
| --- | --- |
| 401, expired/invalid credentials | Use existing session recovery/sign-in; preserve form inputs where appropriate |
| 403 | Show access denied; do not show another user's data or retry as another role |
| 404 | Show filing/Client not found with return-to-list navigation |
| 422 with field details | Map error.details[].field to form controls; show unmatched issues as a form summary |
| VERSION_CONFLICT | Preserve draft, reload latest record, explain another edit occurred, let user review changes before resubmitting |
| VAT_PERIOD_EXISTS | Show existing-period/successor conflict; offer navigation/search, not blind retry |
| INVALID_TRANSITION / VAT_FILED_LOCKED | Refresh detail and update available actions |
| VAT_EVIDENCE_REQUIRED | Refresh documents and highlight the required purpose/selection |
| VAT_REVIEW_REQUIRED / VAT_APPROVAL_REQUIRED | Refresh state and guide the user back to review/approval |
| VAT_ACTION_REQUIRED / VAT_HISTORY_RETAINED | Explain the action is unavailable; fix UI controls to use supported actions |
| 429 | Show retry-later feedback without automatic mutation replay |
| 500 / upload configuration error | Show recoverable failure with correlation ID for support |
| Network error / timeout after a write | Outcome is unknown: refetch history/detail before offering another attempt |

A missing expectedVersion on a workflow action fails Joi validation with 422.
A stale supplied version produces 409 VERSION_CONFLICT. Generic VAT PATCH with no
expectedVersion reaches the service guard and returns 409 VERSION_CONFLICT.
Do not treat all 409s as the same issue or all errors as field validation.

There is no command idempotency-key replay contract. After a lost submission
response, reload to see whether stage is already FILED. After a lost payment
response, compare settlement and history. Never silently repeat a mutation with
a newly fetched version. User decisions must apply to the latest reviewed data.

## 10. Dashboard integration

GET /api/v1/client/dashboard/kpi returns data.vatDue alongside existing KPIs.
vatDue counts VAT_RETURN_FILING records whose service status is neither Completed
nor Cancelled and whose dueDate is <= 60 days from today's Dubai calendar date,
including overdue records. It is global and ignores the dashboard's legacy expiry
filters. It does not count unpaid tax on filed returns or legacy package-only VAT.

Do not calculate a global VAT count from the current list page. Clicking the KPI
may open the VAT workspace with a deadline upper bound; explain that a single
status filter cannot express both Pending and In Progress. The list endpoint has
no dedicated outstanding=true filter. Do not display an inaccurately filtered
page as an exact drill-down of this count.

## 11. Acceptance checklist for the frontend

- [ ] ADMIN-only navigation/routes; unauthenticated, inactive and AGENT states tested.
- [ ] Existing Client context and global company selection use correct Client/company IDs.
- [ ] Company with missing/invalid TRN cannot create a filing; no TRN field sent in filing body.
- [ ] Create form sends correct constants and real dates; redirects to returned service ID.
- [ ] List supports actual filters, stable loading/error/empty states and Previous/Next pagination.
- [ ] Every response envelope is unwrapped correctly; missing optional values are handled.
- [ ] Date-only values display consistently in both negative and positive UTC timezones.
- [ ] Forms keep money as decimal strings; previews handle 0.30 - 0.20 exactly and show credits.
- [ ] Separate filing, service-fee and VAT-settlement indicators are visible.
- [ ] Source and working-paper evidence is uploaded first and selected by returned IDs.
- [ ] Request-review, approve-review and record-approval cannot be skipped in the primary flow.
- [ ] Editing a reviewed calculation warns about resetting approval and refreshes its state.
- [ ] Submission records evidence and manual reference; never claims to submit to EmaraTax.
- [ ] Filed data is read-only while tax settlement, assignment and fee/admin actions remain correct.
- [ ] Cumulative payment semantics, correction reason, overpayment and zero/credit cases tested.
- [ ] Cancellation overrides the stored stage; reopening returns the UI to preparation.
- [ ] Next period uses explicit dates, returned nextService ID, and handles duplicate-successor conflicts.
- [ ] Current reminder reflects scheduling/completion and cancellation after filing.
- [ ] Linked documents have no delete control; failed actions reuse already uploaded evidence.
- [ ] Stale versions preserve edits and require review; writes never auto-retry.
- [ ] History renders readable action details and available evidence links.
- [ ] Backend gaps are visible and no unsupported search/sort/users/refund endpoints are called.

Use mocked API responses for frontend tests; include 401/403/404/409/422/500,
network failure after a mutation, malformed/non-JSON response, duplicate files,
stale list responses and both null and omitted optional fields.

## 12. Backend readiness and boundaries

Before end-to-end rollout, the backend deployment needs a MongoDB replica set,
Cloudinary configuration, credentialed CORS for the frontend origin, and the VAT
index migration (npm run migrate:vat) run in the BACKEND repository.

At handoff time, focused backend tests passed; the full backend suite had
pre-existing failures. Real replica-set integration tests and index migration
were not run in this session. A local frontend success does not prove production
transaction/index configuration is ready. Coordinate deployment verification.

Backend facts requiring explicit treatment in the frontend:
- No staff-directory endpoint for arbitrary Admin selection.
- No server-generated form catalog, allowedActions or populated actor/company names.
- No file deletion/replacement, tax refund processing or filed-return correction API.
- No outward client approval request, email/WhatsApp reminder or automatic filing.
- No tax deadline calculation, period auto-generation or annual package container.
- No exact KPI-outstanding filter or total-count metadata on the VAT list.
- Only identical TRN/start/end tuples are prevented by the unique period index;
  do not claim a general overlap checker for independently created periods.
- A successor can be found via previousService; no dedicated next-period lookup endpoint.
- Status and fee enums use different casing from VAT stages and tax settlement;
  send the exact values in this document.

## 13. Prompt to paste into the frontend Codex chat

> Implement the UAE VAT filing frontend using the attached
> vat-filing-frontend-handoff.md as the self-contained backend contract.
> First inspect this frontend repository and reuse its authentication, API client,
> design system, routing, forms and data-fetching conventions. Build the Admin VAT
> list, company-specific creation, detail workflow, purpose-based uploads,
> preparation/review/client approval, manual submission recording, separate tax
> settlement and service fees, reminders, history and next-period creation.
> Implement the documented action guards, exact money/date handling, response
> shapes, expectedVersion conflict flow, cache refresh and error states. Do not
> invent missing backend endpoints; use the documented fallback for assignees.
> Finish the frontend implementation and relevant tests/build checks, and report
> any backend deployment dependencies. This chat has no access to the original
> backend conversation, so use the attached document as the integration reference.
