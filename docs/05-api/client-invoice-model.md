# Client invoice persistence model

ClientInvoice uses clientInvoices. Admin CRUD routes remain at
/api/v1/client/invoices. This schema replaces the previous invoice shape.

Required clientId and companyId reference Client and ClientCompany. The company
must belong to the client. clientId is immutable. Document saves copy the
company's vatTaxRegistrationNumber into trnNo. POST requires trnNo to match
that value; a company without a VAT registration number cannot be used for POST.

invoiceType is "Operio To Client" (default) or "Client To Customer".
POST requires customerName, fullAddress and emailAddress (valid email).
Optional banking strings: accountNo, switftBIC, iban. The spelling switftBIC is intentional. Optional emirate accepts Abu Dhabi, Dubai,
Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, or Fujairah.
Optional contactNo accepts UAE mobile and geographic landline numbers in compact
local, +971, or 00971 form, e.g. 0501234567, +971501234567, 041234567.
POST requires explicit ISO issueDate and dueDate. The model default remains
available for internal callers.

service is a required nonempty array (API maximum 100). Each line requires:
itemDescription (string), qty (finite number > 0, fractions allowed), govtRate,
servicePrice, taxCode (numeric 0 or 5), taxAmount, grandTotal.
All monetary fields are nonnegative AED Decimal128 with at most two decimals.
API callers provide money as decimal strings. taxAmount and grandTotal are
supplied invoice facts; no tax base or line-total formula is inferred.

grandTotalTaxAmount sums service.taxAmount; grandTotalAmount sums
service.grandTotal. Both are stored before saves, using exact integer fils.
They cannot be supplied through the API. List and write responses return money
as Decimal128 JSON objects such as { "$numberDecimal": "420.00" }.
GET /api/v1/client/invoices/:id returns numeric amounts directly: the service
fields govtRate, servicePrice, taxAmount and grandTotal, and the invoice fields
grandTotalTaxAmount and grandTotalAmount (for example, "govtRate": 500).
Detail consumers must read these values directly instead of .$numberDecimal.
The detail response always includes data.contactNo: the saved invoice contact
number as a string, or null when no contact number was saved.
Storage and calculations remain exact Decimal128/integer fils; detail response
numbers use JavaScript number precision and do not preserve trailing zeros.

invoiceNo is generated on document save through the common Counter service,
using UTC creation year: OP-YYYY-0001. Both invoice types share the yearly
sequence; it starts at 1, pads to at least four digits and may have gaps after
failed writes. The number cannot be changed through the API.

POST requires clientId, companyId, invoiceType, customerName, fullAddress, trnNo,
emailAddress, issueDate, dueDate, and at least one service. Optional fields are
emirate, contactNo, accountNo, switftBIC, and iban.
PATCH requires expectedVersion and at least one editable field. Replacing
service replaces the whole list. clientId is fixed at creation; invoiceNo, totals
and raw version/timestamps are server managed. trnNo is supplied and checked on
POST, then refreshed from the company on saves; it is not PATCH-editable. DELETE requires expectedVersion in query.
GET supports page (1), limit (25, max 100), search (literal client/company name).
Detail and write responses populate clientId and companyId. GET /invoices returns
only _id, invoiceId (the stored invoiceNo), clientName, customerName, invoiceType,
grandTotalAmount, issueDate and dueDate per row. Missing values return null;
grandTotalAmount retains Decimal128 JSON format. Search is case-insensitive
and matches client name OR company name. page ranges from 1 to 1000000; limit
from 1 to 100; search is trimmed, at most 200 characters, and may be empty.
Unknown query keys are rejected. Sorting is newest creation first, then _id.
Existing authentication, response
envelopes, ETags, optimistic concurrency, pagination and error codes are retained.

Model updateOne/updateMany/findOneAndUpdate support whole-service replacement
and ordinary scalar edits. Totals are set atomically with service replacement.
Partial array operations, reference/generated-field edits, upserts, pipelines,
replacement writes, insertMany and bulkWrite are rejected; use document save
or the invoice service. Raw collection writes bypass all model safeguards.

## Deployment migration

Stop invoice writes and back up the collection. The migration script defaults
to validation only:
node scripts/migrate-client-invoice-indexes.js

For old documents, provide INVOICE_MIGRATION_FILE pointing to a JSON object
keyed by invoice ObjectId, each value containing the complete new invoice fields.
This explicit mapping is needed because legacy service references, tax codes,
advance amounts and optional companies cannot be converted without business
decisions. Preserve each old number; the script does so automatically.
Dry-run validation checks every replacement and company ownership before writes.
After reviewing the mapping, run with --apply to replace mapped documents,
remove the old invoice indexes, create new indexes and seed yearly counters.
It never lowers counters. Reruns are supported. Do not resume writes after a
partial failure until the migration finishes. The script does not run as part
of application startup.


## Frontend handoff: create invoice

Use this section as the integration contract. Executable examples are in
client-invoice.routes.js.

### Endpoint

- POST /api/v1/client/invoices
- Content-Type: application/json
- Authenticated ADMIN session required. Use credentials: "include" with fetch.
- No query parameters. Send JSON, not FormData.
- Success: 201 Created, Location: /api/v1/client/invoices/{id}, ETag: "0".

### Validation

| Field | Required | Rule |
| --- | --- | --- |
| clientId | Yes | 24-character hexadecimal ObjectId; client must exist |
| companyId | Yes | 24-character hexadecimal ObjectId; company must belong to clientId |
| invoiceType | Yes | Exactly Operio To Client or Client To Customer |
| customerName | Yes | Nonempty trimmed string |
| fullAddress | Yes | Nonempty trimmed string |
| trnNo | Yes | Nonempty trimmed string matching company.vatTaxRegistrationNumber |
| emailAddress | Yes | Valid trimmed email address |
| issueDate | Yes | ISO date/datetime string; recommended YYYY-MM-DDT00:00:00.000Z |
| dueDate | Yes | ISO date/datetime string; no ordering rule relative to issueDate |
| service | Yes | Array of 1?100 complete service objects |
| emirate | No | Abu Dhabi, Dubai, Sharjah, Ajman, Umm Al Quwain, Ras Al Khaimah, Fujairah |
| contactNo | No | Compact UAE local, +971 or 00971 phone format; e.g. 0501234567, +971501234567, 041234567 |
| accountNo | No | Nonempty trimmed string when supplied |
| switftBIC | No | Nonempty trimmed string; retain this spelling |
| iban | No | Nonempty trimmed string when supplied |

Omit unused optional fields. Empty strings and null are rejected.
Unknown fields are rejected, including the old spellings fullAddres and
emailAddres, and generated invoiceNo, grandTotalTaxAmount, grandTotalAmount,
version and timestamps. Joi collects all field errors.

Each service object requires:
- itemDescription: nonempty trimmed string.
- qty: positive number; fractions allowed.
- govtRate, servicePrice, taxAmount, grandTotal: nonnegative decimal strings,
  1?16 integer digits and at most two decimals. Do not send JSON numbers.
- taxCode: number 0 or 5.

Line taxAmount and grandTotal are supplied by the frontend. The backend sums
these amounts exactly; it does not infer tax bases or calculate line totals.
Prefill trnNo from the selected company's vatTaxRegistrationNumber. A missing
company TRN must be filled on the company record before creating an invoice.

### Request example

Replace IDs and TRN with matching database values.

~~~json
{
  "clientId": "68ad00000000000000000001",
  "companyId": "68ad00000000000000000002",
  "invoiceType": "Operio To Client",
  "trnNo": "104679354100003",
  "customerName": "Example Client",
  "emirate": "Dubai",
  "contactNo": "+971501234567",
  "fullAddress": "Dubai, UAE",
  "emailAddress": "client@example.com",
  "issueDate": "2026-09-03T00:00:00.000Z",
  "dueDate": "2026-09-30T00:00:00.000Z",
  "accountNo": "123456789",
  "switftBIC": "EXAMPLE",
  "iban": "AE000000000000000000000",
  "service": [
    {
      "itemDescription": "VAT filing",
      "qty": 1,
      "govtRate": "0.00",
      "servicePrice": "400.00",
      "taxCode": 5,
      "taxAmount": "20.00",
      "grandTotal": "420.00"
    }
  ]
}
~~~

### Success response example

clientId and companyId are populated objects in responses rather than request
ID strings. Selected client mobileNumber/emailAddress and company
vatTaxRegistrationNumber also appear when present. Monetary fields serialize
as Decimal128 objects: read amount.$numberDecimal for the decimal string.

~~~json
{
  "data": {
    "clientId": {
      "id": "68ad00000000000000000001",
      "name": "Example Client"
    },
    "companyId": {
      "id": "68ad00000000000000000002",
      "companyName": "Example Company"
    },
    "invoiceType": "Operio To Client",
    "trnNo": "104679354100003",
    "customerName": "Example Client",
    "emirate": "Dubai",
    "contactNo": "+971501234567",
    "fullAddress": "Dubai, UAE",
    "emailAddress": "client@example.com",
    "issueDate": "2026-09-03T00:00:00.000Z",
    "dueDate": "2026-09-30T00:00:00.000Z",
    "accountNo": "123456789",
    "switftBIC": "EXAMPLE",
    "iban": "AE000000000000000000000",
    "service": [
      {
        "itemDescription": "VAT filing",
        "qty": 1,
        "govtRate": {
          "$numberDecimal": "0.00"
        },
        "servicePrice": {
          "$numberDecimal": "400.00"
        },
        "taxCode": 5,
        "taxAmount": {
          "$numberDecimal": "20.00"
        },
        "grandTotal": {
          "$numberDecimal": "420.00"
        }
      }
    ],
    "id": "68ad00000000000000000004",
    "invoiceNo": "OP-2026-0001",
    "grandTotalTaxAmount": {
      "$numberDecimal": "20.00"
    },
    "grandTotalAmount": {
      "$numberDecimal": "420.00"
    },
    "version": 0,
    "createdAt": "2026-09-03T10:00:00.000Z",
    "updatedAt": "2026-09-03T10:00:00.000Z"
  },
  "meta": {
    "correlationId": "request-correlation-id"
  }
}
~~~

IDs, invoice numbers and timestamps are illustrative. invoiceNo uses creation
year, independently of issueDate. Save data.version for future PATCH/DELETE.

### Error responses

| HTTP | Code | Meaning |
| --- | --- | --- |
| 401 | Authentication middleware code | Missing, expired or invalid session |
| 403 | Authorization middleware code | User is not an ADMIN |
| 404 | CLIENT_NOT_FOUND | Client does not exist |
| 422 | VALIDATION_FAILED | Joi or model validation failed |
| 422 | INVOICE_COMPANY_MISMATCH | Company missing or belongs to another client |
| 422 | INVOICE_TRN_MISMATCH | TRN differs from the selected company's value |
| 409 | VERSION_CONFLICT | Generated-number uniqueness conflict |
| 500 | INTERNAL_ERROR | Unexpected server error |

~~~json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The invoice request is invalid.",
    "details": [
      {
        "field": "fullAddress",
        "issue": "\"fullAddress\" is required"
      }
    ]
  },
  "meta": {
    "correlationId": "request-correlation-id"
  }
}
~~~

Map error.details to form fields; nested paths look like service.0.qty.
Fall back to error.message when details is empty. Keep meta.correlationId
for troubleshooting. Prevent duplicate submissions; there is no idempotency
replay contract, so do not automatically retry an ambiguous POST failure.

### Fetch example

~~~javascript
const response = await fetch(apiBaseUrl + "/api/v1/client/invoices", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(payload),
});
const body = await response.json();
if (!response.ok) {
  // Map body.error.details to form fields and display body.error.message.
  throw body.error;
}
const createdInvoice = body.data;
const totalAED = createdInvoice.grandTotalAmount.$numberDecimal;
~~~
