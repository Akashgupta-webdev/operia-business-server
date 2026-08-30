# Client Information Update API

This is the frontend integration contract for partially updating fields on an
existing Client record.

## Endpoint and Authorization

`PATCH /api/v1/client/{id}`

The endpoint requires an authenticated, active User with the `ADMIN` role.
`id` is the required 24-character hexadecimal MongoDB `_id` of the Client.

The JSON body must contain at least one editable field. Unknown fields,
including `_id`, `id`, `version`, `createdAt`, and `updatedAt`, are rejected.

## Editable Fields

| Field | Validation when supplied |
| --- | --- |
| `name` | Trimmed string, 2-200 characters |
| `mobileNumber`, `whatsappNumber` | `null` or a non-empty trimmed string up to 30 characters |
| `emailAddress` | `null` or a valid email up to 254 characters; normalized to lowercase |
| `nationality` | One of the nationality select options below |
| `clientType` | `INDIVIDUAL` or `COMPANY` |
| `status` | `Active`, `Inactive`, `Archived`, or `Draft` |
| `preferredCommunicationMethod` | `Email`, `Whatsapp`, or `Call` |
| `passport` | `null` or a non-empty passport object |
| `emirates` | `null` or a non-empty Emirates ID object |
| `visa` | `null` or a non-empty visa object |
| `healthInsurance` | `null` or a non-empty health-insurance object |

Nationality select options are `United Arab Emirates`, `India`, `Pakistan`,
`Philippines`, `Egypt`, `United Kingdom`, and `Germany`.

Identity date fields use `dd-mm-yyyy`. Passport numbers use one uppercase
letter followed by seven digits. Emirates IDs use `784-YYYY-XXXXXXX-X`, and
Visa UID numbers contain 9-15 digits. Supplying an identity object replaces
that complete nested object; send `null` to clear it.

## Example

```js
const response = await fetch(`/api/v1/client/${clientId}`, {
  method: "PATCH",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Example Client",
    emailAddress: "client@example.com",
    nationality: "United Arab Emirates",
    preferredCommunicationMethod: "Email",
    status: "Active",
  }),
});
```

A successful update returns `200 OK`, the complete updated Client in `data`,
the request correlation ID in `meta`, and an `ETag` containing the updated
optimistic-concurrency version.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `404` | `CLIENT_NOT_FOUND` | No Client exists with the supplied `_id` |
| `422` | `VALIDATION_FAILED` | The id or request body is invalid |
| `500` | `INTERNAL_ERROR` | The update failed unexpectedly |
