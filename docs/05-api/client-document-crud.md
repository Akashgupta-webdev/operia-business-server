# Client Document Create and Delete API

These endpoints add one file to an existing Client and delete one Client
Document together with its Cloudinary asset. Both endpoints require an
authenticated, active `ADMIN`.

## Add a Client Document

`POST /api/v1/client/{id}/document`

Send `multipart/form-data` with exactly one binary field named `documents`.
The file may be at most 10 MiB. The following optional text fields may be sent
in the same form; unknown fields are rejected.

| Field | Validation |
| --- | --- |
| `documentTitle` | Trimmed string, 1-200 characters; defaults to the original filename |
| `documentType` | `Passport`, `Emirates ID`, `Visa`, `Trade Licence`, or `Other`; defaults to `Other` |
| `issueDate` | `dd-mm-yyyy` |
| `expiryDate` | `dd-mm-yyyy` |

The Client `id` must be a 24-character hexadecimal MongoDB identifier. The
server uploads the file to Cloudinary and owns `documentURL` and all Cloudinary
identifiers. A successful request returns `201`, a `Location` header pointing
to `/api/v1/client/document/{documentId}`, and the created Client Document in
the standard response envelope. If persistence fails after upload, the newly
uploaded Cloudinary asset is removed.

## Delete a Client Document

`DELETE /api/v1/client/document/{id}`

The Document `id` must be a 24-character hexadecimal MongoDB identifier. The
server deletes the Cloudinary asset before deleting its MongoDB metadata. A
successful request returns `200` with:

```json
{
  "data": { "id": "68ad00000000000000000003" },
  "meta": { "correlationId": "opaque-correlation-id" }
}
```

## Errors

| HTTP | Code | Meaning |
| --- | --- | --- |
| `404` | `CLIENT_NOT_FOUND` | The Client selected for upload does not exist |
| `404` | `CLIENT_DOCUMENT_NOT_FOUND` | The Document selected for deletion does not exist |
| `422` | `VALIDATION_FAILED` | The path, metadata, or multipart file is invalid |
| `500` | `UPLOAD_CONFIGURATION_ERROR` | Cloudinary is not configured |
| `500` | `INTERNAL_ERROR` | Cloudinary or persistence failed unexpectedly |
