# Complete Client Creation API

This is the frontend integration contract for creating a Client and its
optional Company, Members, Vehicles, Drivers, Services, Documents, Payments,
and Reminders in one request.

## Endpoint

`POST /api/v1/client`

The endpoint requires an authenticated, active `ADMIN`. Authentication uses
the existing HTTP-only cookies. Successful responses include
`X-Correlation-Id`, `Location`, and `ETag` headers.

## Request Encoding and Documents

Use `multipart/form-data` when uploading documents:

| Form field | Type | Requirement |
| --- | --- | --- |
| `payload` | JSON encoded as a string | Required |
| `documents` | Repeated binary file field | Optional; maximum 10 files, 10 MiB each |

Do not manually set the multipart `Content-Type` header in browser code; the
browser must add its boundary. The same payload may be sent directly as
`application/json` when no files are uploaded.

```js
const form = new FormData();
form.append("payload", JSON.stringify(payload));
for (const file of selectedFiles) form.append("documents", file);

const response = await fetch("/api/v1/client", {
  method: "POST",
  credentials: "include",
  body: form,
});
```

`payload.documents[index]` describes the file at `documents[index]`. If
metadata is supplied, its length must exactly match the number of files. If
metadata is omitted, the original filename and `documentType: "Other"` are
used. The frontend must not send `documentURL`; Cloudinary supplies it.

## Payload Shape

Unknown fields are rejected at every level. Never send a `client` reference
inside a related item; the server creates the Client and injects its MongoDB
`_id` into every related record.

| Field | Type and requirement |
| --- | --- |
| `client` | Required object |
| `company` | Required only for `client.clientType: "COMPANY"`; otherwise forbidden |
| `members` | Optional array; maximum 100 |
| `vehicles` | Optional array; maximum 100 |
| `drivers` | Optional array; maximum 100 |
| `services` | Optional array; maximum 100 |
| `documents` | Optional metadata array; maximum 10 |
| `payments` | Optional array; maximum 100 |
| `reminders` | Optional array; maximum 100 |

### Client and Identity Fields

| Field | Validation |
| --- | --- |
| `name` | Required trimmed string, 2-200 characters |
| `nationality` | `United Arab Emirates`, `India`, `Pakistan`, `Philippines`, `Egypt`, `United Kingdom`, or `Germany` |
| `mobileNumber`, `whatsappNumber` | Optional non-empty string, maximum 30 characters |
| `emailAddress` | Optional email, maximum 254 characters; normalized to lowercase |
| `clientType` | `INDIVIDUAL` or `COMPANY`; defaults to `INDIVIDUAL` |
| `passport` | Optional object |
| `emirates` | Optional object |
| `visa` | Optional object |
| `healthInsurance` | Optional object |

| Identity object | Accepted fields |
| --- | --- |
| `passport` | `passportNumber` (one letter and seven digits, e.g. `A1234567`), `passportIssueDate`, `passportExpiryDate` |
| `emirates` | `emiratesId` (`784-YYYY-XXXXXXX-X`), `emiratesIssueDate`, `emiratesExpiryDate` |
| `visa` | `visaUIDNumber` (9-15 digits), `visaIssueDate`, `visaExpiryDate` |
| `healthInsurance` | `healthInsuranceCardNumber`, `healthInsuranceIssueDate`, `healthInsuranceExpiryDate` |

All date-only fields are strings in `dd-mm-yyyy` format, for example
`31-12-2027`.

### Company

| Field | Validation |
| --- | --- |
| `companyName` | Required trimmed string, 2-200 characters |
| `tradeLicenceNumber` | Optional, maximum 100 characters |
| `licenceExpiryDate` | Optional `dd-mm-yyyy` |
| `vatTaxRegistrationNumber` | Optional, maximum 100 characters |
| `corporateTaxNumber` | Optional, maximum 100 characters |

### Members, Vehicles, and Drivers

Each `members` item accepts `memberType`, `name`, `passport`, `emirates`,
`visa`, and `healthInsurance`. Identity objects use the Client rules.
`memberType` is `Partner`, `Employee/Staff`, `Manger`, `Director`, or `Other`.

| Section | Accepted fields |
| --- | --- |
| `vehicles[]` | `registrationNumer`, `tcNumber`, `policyNumber`, `registrationExpiry`, `insuranceExpiry` |
| `drivers[]` | `name`, `licenceIssueDate`, `licenceExpiryDate` |

Vehicle and Driver dates use `dd-mm-yyyy`. `registrationNumer` reflects the
current backend model spelling and must be sent exactly as shown.

### Services

| Field | Validation |
| --- | --- |
| `category` | `Business Setup`, `Visa & Immigration`, `Tax & Accounting`, `PRO Services`, or `Legal & Advisory` |
| `package` | One exact package value from the list below |
| `status` | `In Progress`, `Pending`, `Completed`, or `Cancelled` |
| `packagePrice` | Non-negative decimal string with at most two decimal places |
| `paymentStatus` | `Unpaid`, `Partial`, or `Paid` |
| `targetCompletionDate` | `dd-mm-yyyy` |
| `notes` | String array; maximum 1,000 characters per item |

Accepted packages:

- `Mainland LLC Company Formation Package`
- `Freezone Company Formation Package`
- `Offshore Company Setup Package`
- `Trade Licence Renewal Package`
- `Trade Licence Amendment / Partner Change`
- `Instant / Freelance License Setup`
- `Bank Account Opening Assistance Package`
- `Branch Office / Foreign Entity Setup`
- `Custom Business Setup Service`
- `Investor / Partner 2-Year Visa Package`
- `Employment Visa (Normal / Skilled) Package`
- `Golden Visa (10-Year Residency) Package`
- `Family / Dependent Visa Package`
- `Domestic Worker / Maid Visa Package`
- `Visa Cancellation / Change of Status Package`
- `Emirates ID & VIP Medical Assistance`
- `Tourist / Visit Visa Extension Package`
- `Custom Visa & Immigration Service`
- `Corporate Tax Registration Package`
- `Annual Corporate Tax Return Filing`
- `VAT Registration Package`
- `VAT Deregistration Package`
- `Quarterly VAT Return Filing Package`
- `Monthly Bookkeeping & Accounting Package`
- `Financial Audit & Balance Sheet Assistance`
- `Tax Assessment & Advisory Consultation`
- `Custom Tax & Accounting Service`
- `Establishment Card (New / Renewal) Package`
- `MOHRE / Labour File & Quota Processing`
- `Signature Card Issuance & E-Sign Activation`
- `Municipality / Civil Defence / External Approvals`
- `Legal Translation & Notarization Package`
- `Customs Code (New / Renewal) Package`
- `Tenancy Contract / Ejari Registration Assistance`
- `Commercial Vehicle / Fleet Approval Assistance`
- `Custom PRO Service`
- `MOA & Shareholder Agreement Drafting / Amendment`
- `Power of Attorney (POA) & Board Resolution`
- `Trademark Registration & Brand Protection`
- `Company Liquidation / Deregistration Package`
- `Commercial Contract Review & Legal Advisory`
- `UBO & ESR (Economic Substance) Compliance Filing`
- `Share Transfer / Capital Increase Agreement`
- `Custom Legal & Advisory Service`

### Document Metadata

Each `documents` item accepts `documentTitle`, `documentType`, `issueDate`, and
`expiryDate`. Dates use `dd-mm-yyyy`. `documentType` is `Passport`,
`Emirates ID`, `Visa`, `Trade Licence`, or `Other`.

### Payments and Reminders

Each `payments` item accepts:

- `totalBilled`, `amountReceived`: non-negative decimal strings with at most
  two decimal places;
- `paymentStatus`: `Unpaid`, `Partially Paid`, `Paid`, or `Credit`;
- `paymentMethod`: `Cash`, `Bank Transfer`, `Credit Card`, or `Cheque`;
- `notes`: string array, maximum 1,000 characters per item.

Each `reminders` item accepts:

- `followupDate`: `dd-mm-yyyy`;
- `remindBefore`: `1 day before`, `3 day before`, `7 day before`,
  `14 day before`, or `30 before day`;
- `priority`: `Low`, `Normal`, or `High`;
- `notes`: string array, maximum 1,000 characters per item.

## Complete Example

```json
{
  "client": {
    "name": "Example Person",
    "nationality": "India",
    "mobileNumber": "+971501234567",
    "whatsappNumber": "+971501234567",
    "emailAddress": "person@example.test",
    "clientType": "COMPANY",
    "passport": {
      "passportNumber": "A1234567",
      "passportIssueDate": "01-01-2020",
      "passportExpiryDate": "01-01-2030"
    },
    "emirates": {
      "emiratesId": "784-1990-1234567-1",
      "emiratesIssueDate": "01-02-2025",
      "emiratesExpiryDate": "01-02-2027"
    },
    "visa": {
      "visaUIDNumber": "123456789",
      "visaIssueDate": "01-02-2025",
      "visaExpiryDate": "01-02-2027"
    },
    "healthInsurance": {
      "healthInsuranceCardNumber": "HI-1001",
      "healthInsuranceIssueDate": "01-03-2026",
      "healthInsuranceExpiryDate": "01-03-2027"
    }
  },
  "company": {
    "companyName": "Example Trading LLC",
    "tradeLicenceNumber": "TL-1001",
    "licenceExpiryDate": "31-12-2027",
    "vatTaxRegistrationNumber": "VAT-1001",
    "corporateTaxNumber": "CT-1001"
  },
  "members": [{ "memberType": "Partner", "name": "Example Partner" }],
  "vehicles": [{
    "registrationNumer": "DUBAI-A-12345",
    "tcNumber": "TC-1001",
    "policyNumber": "POL-1001",
    "registrationExpiry": "31-12-2027",
    "insuranceExpiry": "31-12-2027"
  }],
  "drivers": [{
    "name": "Example Driver",
    "licenceIssueDate": "01-01-2025",
    "licenceExpiryDate": "01-01-2030"
  }],
  "services": [{
    "category": "Business Setup",
    "package": "Mainland LLC Company Formation Package",
    "status": "Pending",
    "packagePrice": "1500.00",
    "paymentStatus": "Partial",
    "targetCompletionDate": "30-09-2026",
    "notes": ["Awaiting external approval"]
  }],
  "documents": [{
    "documentTitle": "Passport copy",
    "documentType": "Passport",
    "issueDate": "01-01-2020",
    "expiryDate": "01-01-2030"
  }],
  "payments": [{
    "totalBilled": "1500.00",
    "amountReceived": "500.00",
    "paymentStatus": "Partially Paid",
    "paymentMethod": "Bank Transfer",
    "notes": ["Initial payment received"]
  }],
  "reminders": [{
    "followupDate": "23-09-2026",
    "remindBefore": "7 day before",
    "priority": "High",
    "notes": ["Check approval status"]
  }]
}
```

This example has one metadata item, so append exactly one binary `documents`
field to the multipart request.

## Success Response

Successful creation returns `201 Created` after the complete MongoDB
transaction commits. Related items contain the same Client `_id`.

```json
{
  "data": {
    "client": {
      "id": "68ad00000000000000000001",
      "name": "Example Person",
      "clientType": "COMPANY",
      "status": "Active",
      "preferredCommunicationMethod": "Call",
      "version": 0
    },
    "company": {
      "id": "68ad00000000000000000002",
      "client": "68ad00000000000000000001",
      "companyName": "Example Trading LLC",
      "version": 0
    },
    "members": [],
    "vehicles": [],
    "drivers": [],
    "services": [],
    "documents": [{
      "id": "68ad00000000000000000003",
      "client": "68ad00000000000000000001",
      "documentTitle": "Passport copy",
      "documentURL": "https://res.cloudinary.com/example/document.pdf",
      "documentType": "Passport",
      "version": 0
    }],
    "payments": [],
    "reminders": []
  },
  "meta": { "correlationId": "opaque-correlation-id" }
}
```

`Location` is `/api/v1/client/{clientMongoId}` and `ETag` contains the Client
version. Decimal128 values serialize as extended JSON, for example
`{ "$numberDecimal": "1500.00" }`.

## Errors and Atomicity

| HTTP | Code | Meaning |
| --- | --- | --- |
| `400` | `MALFORMED_REQUEST` | `payload` is not valid JSON |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `422` | `VALIDATION_FAILED` | Joi validation or upload limits failed |
| `500` | `UPLOAD_CONFIGURATION_ERROR` | Cloudinary is not configured |
| `500` | `INTERNAL_ERROR` | Upload or persistence failed unexpectedly |

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "The client creation request is invalid.",
    "details": [{
      "field": "client.name",
      "issue": "\"client.name\" is required"
    }]
  },
  "meta": { "correlationId": "opaque-correlation-id" }
}
```

Uploads finish before the database transaction. If persistence fails, uploaded
Cloudinary assets are deleted. No partial database success is returned.
