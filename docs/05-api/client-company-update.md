# Client Company Information Update API

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
| `tradeLicenceNumber` | `null` or a non-empty trimmed string up to 100 characters |
| `licenceExpiryDate` | `null` or a date string in `dd-mm-yyyy` format |
| `vatTaxRegistrationNumber` | `null` or a non-empty trimmed string up to 100 characters |
| `corporateTaxNumber` | `null` or a non-empty trimmed string up to 100 characters |

The current Client Company model has no enum-backed select fields, so there
are no select options for this endpoint. All editable fields are text inputs
except `licenceExpiryDate`, which is a formatted date input.

## JavaScript Example

```js
const response = await fetch(`/api/v1/client/${clientId}/company`, {
  method: "PATCH",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    companyName: "Example Trading LLC",
    tradeLicenceNumber: "TL-2002",
    licenceExpiryDate: "31-12-2030",
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
