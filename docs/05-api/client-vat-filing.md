# Client VAT filing API

See [business workflow](../06-workflows/vat-filing.md) for lifecycle rules.
All endpoints require the existing authentication cookies and an active ADMIN.
These APIs record manually prepared and submitted UAE returns. They do not submit
to EmaraTax, store government credentials, calculate deadlines, or prepare VAT201.

## Create a filing

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

## Read

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

## Upload filing evidence

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

## Business actions

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

## Generic service PATCH and DELETE

VAT PATCH only accepts packagePrice, paymentStatus, targetCompletionDate and notes,
plus required expectedVersion. Filing identity/period/status cannot be set through
generic PATCH. Fee and administrative edits remain possible after filing.
DELETE of VAT services returns 409 VAT_HISTORY_RETAINED; use cancel before filing.

## Conflicts and errors

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

## Deployment and verification

A MongoDB replica set is required for action transactions.
Run `npm run migrate:vat` with the deployment MONGODB_URI before enabling VAT writes.
It creates indexes without dropping unrelated ones or modifying legacy records.
The migration has not been executed against your database by this implementation.

Run `npm run test:vat` for unit and HTTP contract tests.
Run `npm run test:vat:integration` with VAT_TEST_MONGODB_URI pointing to a dedicated
local replica set for real uniqueness, concurrent writes, rollback and recurrence.
The integration suite creates and removes only its generated vat_test_* database.
