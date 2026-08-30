# Client Service Create, Update, and Delete API

These endpoints manage Service records belonging to Clients. Every endpoint
requires an authenticated, active User with the `ADMIN` role.

## Create

`POST /api/v1/client/{id}/service`

`id` is the required 24-character hexadecimal MongoDB `_id` of the owning
Client. The JSON body must contain at least one editable Service field. The
server verifies the Client and injects its reference. Successful creation
returns `201 Created`, `Location`, `ETag`, and the created Service.

## Update

`PATCH /api/v1/client/service/{id}`

`id` is the required 24-character hexadecimal Service MongoDB `_id`. The JSON
body is partial and must contain at least one editable field. Supplying `null`
clears an optional value. Successful updates return `200 OK`, the updated
Service, and its incremented version in `ETag`.

## Delete

`DELETE /api/v1/client/service/{id}`

`id` is the required 24-character hexadecimal Service MongoDB `_id`. A
successful deletion returns `200 OK` with the deleted identifier.

## Editable fields

| Field | Validation |
| --- | --- |
| `category` | `Business Setup`, `Visa & Immigration`, `Tax & Accounting`, `PRO Services`, or `Legal & Advisory` |
| `package` | One package defined by the Client Service model |
| `status` | `In Progress`, `Pending`, `Completed`, or `Cancelled` |
| `packagePrice` | Non-negative decimal string with at most two decimal places |
| `paymentStatus` | `Unpaid`, `Partial`, or `Paid` |
| `targetCompletionDate` | Date string using `dd-mm-yyyy` |
| `notes` | Maximum 100 non-empty strings; maximum 1,000 characters each |

Unknown and server-managed fields such as `client`, `_id`, `version`, and
timestamps are rejected. Create bodies do not accept `null`; unavailable
fields must be omitted. Update bodies accept `null` to clear fields.

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `401` | `AUTHENTICATION_REQUIRED` | Authentication is missing or invalid |
| `403` | `FORBIDDEN` | The authenticated User is not an Admin |
| `404` | `CLIENT_NOT_FOUND` | The owning Client does not exist |
| `404` | `CLIENT_SERVICE_NOT_FOUND` | The selected Service does not exist |
| `422` | `VALIDATION_FAILED` | The path or body is invalid |
| `500` | `INTERNAL_ERROR` | The operation failed unexpectedly |
