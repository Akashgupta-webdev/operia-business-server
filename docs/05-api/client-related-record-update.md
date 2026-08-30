# Client Related Record Create, Update, and Delete API

These endpoints create, update, and delete the Member, Vehicle, and Driver records
associated with Clients. Every endpoint requires an authenticated, active User
with the `ADMIN` role.

## Create endpoints

- `POST /api/v1/client/{id}/member`
- `POST /api/v1/client/{id}/vehicle`
- `POST /api/v1/client/{id}/driver`

`id` is the required 24-character hexadecimal MongoDB `_id` of the owning
Client. Each JSON body must contain at least one field supported by its model;
unknown and server-managed fields such as `client`, `_id`, `version`, and
timestamps are rejected. The server verifies the Client, injects its reference,
and returns `201 Created` with `Location` and `ETag` headers.

Member bodies accept `memberType`, `name`, `passport`, `emirates`, `visa`, and
`healthInsurance`. Vehicle bodies accept `registrationNumer`, `tcNumber`,
`policyNumber`, `registrationExpiry`, and `insuranceExpiry`. Driver bodies
accept `name`, `licenceIssueDate`, and `licenceExpiryDate`. Dates use
`dd-mm-yyyy`, nested identity formats match the Client creation contract, and
`memberType` must be `Partner`, `Employee/Staff`, `Manger`, `Director`, or
`Other`.

## Update endpoints

- `PATCH /api/v1/client/member/{id}`
- `PATCH /api/v1/client/vehicle/{id}`
- `PATCH /api/v1/client/driver/{id}`

`id` is the 24-character hexadecimal MongoDB `_id` of the related record. Each
JSON body is a partial object with at least one editable field. Unknown and
server-managed fields such as `client`, `_id`, `version`, and timestamps are
rejected. A successful update returns `200 OK`, the updated record in `data`,
and its new version in the `ETag` header.

Member fields are `memberType`, `name`, `passport`, `emirates`, `visa`, and
`healthInsurance`. Vehicle fields are `registrationNumer`, `tcNumber`,
`policyNumber`, `registrationExpiry`, and `insuranceExpiry`. Driver fields are
`name`, `licenceIssueDate`, and `licenceExpiryDate`. Text and nested fields may
be set to `null` to clear them. Dates use `dd-mm-yyyy`; nested identity formats
match the Client creation contract.

## Delete endpoint

`DELETE /api/v1/client/related?_id={id}&actionOn={recordType}`

`_id` is a required 24-character hexadecimal MongoDB identifier. `actionOn`
must be exactly `member`, `vehicle`, or `driver`. Unknown query fields are
rejected. A successful deletion returns the deleted `id` and `actionOn` in the
standard response envelope.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `404` | `CLIENT_MEMBER_NOT_FOUND` | The selected Member does not exist |
| `404` | `CLIENT_VEHICLE_NOT_FOUND` | The selected Vehicle does not exist |
| `404` | `CLIENT_DRIVER_NOT_FOUND` | The selected Driver does not exist |
| `422` | `VALIDATION_FAILED` | The path, query, or body is invalid |
| `500` | `INTERNAL_ERROR` | The operation failed unexpectedly |
