# Client Company Information Update API

## Update VAT or TAX Due Dates

`PATCH /api/v1/client/updateNextVATorTAXDueDate/{companyId}` requires an
authenticated, active Admin. `companyId` is the Company's own 24-character
MongoDB identifier, not the owning Client id.

```json
{
  "nextVATDue": "2030-01-01T00:00:00.000Z",
  "nextTAXDue": "2030-02-01T00:00:00.000Z"
}
```

Both fields are optional individually, but at least one must be supplied.
Values must be ISO dates; use midnight UTC for calendar dates. Null, empty
bodies, unknown fields, and invalid identifiers or dates return `422 VALIDATION_FAILED`.
Only supplied fields inside `complianceDueDate` are updated; omitted fields
are preserved. Success returns `200`, the complete Company in `data`, correlation
metadata, and its version in `ETag`. A missing Company returns
`404 CLIENT_COMPANY_NOT_FOUND`. Authentication and authorization use the same
`401`/`403` contract as the Company information endpoint below.

## Update Company Information

This is the frontend integration contract for partially updating the Company
record associated with an existing Client.

## Endpoint and Authorization

`PATCH /api/v1/client/{id}/company`

The endpoint requires an authenticated, active User with the `ADMIN` role.
`id` is the required 24-character hexadecimal MongoDB `_id` of the owning
Client, not the Company `_id`.

The JSON body must contain at least one editable field. Unknown and
server-managed fields, including `client`, `_id`, `id`, `version`, `createdAt`,
and `updatedAt`, are rejected.

## Editable Fields

| Field | Validation when supplied |
| --- | --- |
| `companyName` | Trimmed string, 2-200 characters |
| `tradeLicence.tradeLicenceNo` | `null` or a non-empty trimmed string up to 100 characters |
| `tradeLicence.tradeLicenceExpiry` | `null` or a date string in `dd-mm-yyyy` format |
| `establishment.establishmentCard` | Optional; `null` or a non-empty trimmed string up to 100 characters |
| `establishment.establishmentCardExpiry` | Optional; `null` or a date string in `dd-mm-yyyy` format |
| `vatTaxRegistrationNumber` | `null` or a non-empty trimmed string up to 100 characters |
| `corporateTaxNumber` | `null` or a non-empty trimmed string up to 100 characters |
| `civilDefenceCertificate.certificationNo` | Optional nullable document number, using the format policy below |
| `civilDefenceCertificate.expiryDate` | Optional nullable real calendar date in `dd-mm-yyyy`, year 1900 or later |
| `commercialTradeLicence.licenceNo` | Optional nullable document number, using the format policy below |
| `commercialTradeLicence.expiryDate` | Optional nullable real calendar date in `dd-mm-yyyy`, year 1900 or later |

The two new objects support partial nested updates and null clearing of either
individual fields or the whole object. Omitted siblings remain unchanged.
Both are optional, so existing records need no backfill or database rewrite.
Their expiries appear separately in GET `/api/v1/client/renewals`.

Document number policy: trimmed strings of 1-100 characters, containing at
least one ASCII digit; letters and digits may be separated by single spaces,
dots, slashes or hyphens. Leading zeros and letter case are preserved.
Empty strings, other characters and unknown nested fields are rejected.
This is an application format check, not verification of issuance or a
UAE-wide official number specification. No universal format was established
from the [DET licensing information](https://www.dubaidet.gov.ae/en/licences-and-permits/business-licensing)
and [MOI certificate inquiry](https://cdservices.moi.gov.ae/index/certificate-inquiry)
reviewed. Authority-specific verification requires the relevant issuing authority.

Example partial payload (illustrative identifiers):

```json
{
  "civilDefenceCertificate": {
    "certificationNo": "LCA0000237232-2026",
    "expiryDate": "31-12-2027"
  },
  "commercialTradeLicence": {
    "licenceNo": "CN-1234567",
    "expiryDate": "30-06-2027"
  }
}
```

The current Client Company model has no enum-backed select fields, so there
are no select options for this endpoint. All editable fields are text inputs
except the expiry fields, which are formatted date inputs.

## JavaScript Example

```js
const response = await fetch(`/api/v1/client/${clientId}/company`, {
  method: "PATCH",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    companyName: "Example Trading LLC",
    tradeLicence: {
      tradeLicenceNo: "TL-2002",
      tradeLicenceExpiry: "31-12-2030",
    },
    establishment: {
      establishmentCard: "EC-1001",
      establishmentCardExpiry: "31-12-2030",
    },
    vatTaxRegistrationNumber: "VAT-1001",
    corporateTaxNumber: "CT-1001",
  }),
});

const result = await response.json();
```

A successful update returns `200 OK`, the complete updated Company in `data`,
the request correlation ID in `meta`, and an `ETag` containing the updated
Company version.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `404` | `CLIENT_NOT_FOUND` | No Client exists with the supplied `_id` |
| `404` | `CLIENT_COMPANY_NOT_FOUND` | The Client has no associated Company record |
| `422` | `VALIDATION_FAILED` | The Client id or request body is invalid |
| `500` | `INTERNAL_ERROR` | The update failed unexpectedly |

Company licence fields are sent inside `tradeLicence`; establishment fields are
sent inside `establishment` (`establishmentCard`, `establishmentCardExpiry`).
Both objects are optional. Card numbers are trimmed strings up to 100 characters;
expiry dates use `dd-mm-yyyy`. Only `client` and `companyName` are required by
the Company model. PATCH preserves omitted nested fields and allows null to
clear fields or either object. Legacy top-level licence fields are rejected.
