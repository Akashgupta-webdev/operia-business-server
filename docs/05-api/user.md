# Release 1 User and Notification API

## 1. Scope

This API supports the minimum User administration and in-app Notifications
required by Lead Management. Authentication endpoints are defined in
`authentication.md`; this document defines protected business APIs.

## 2. Endpoints

| Method and path | Action | Authorization |
| --- | --- | --- |
| `GET /api/v1/me` | Current User profile and permissions | Authenticated User |
| `GET /api/v1/users?role=AGENT&status=ACTIVE` | List assignment candidates | Admin |
| `POST /api/v1/users` | Create Agent | Admin |
| `POST /api/v1/users/{id}/activate` | Activate Agent | Admin |
| `POST /api/v1/users/{id}/deactivate` | Deactivate Agent | Admin |
| `GET /api/v1/notifications` | List own Notifications | Authenticated User |
| `POST /api/v1/notifications/{id}/mark-read` | Mark own Notification read | Recipient |

Release 1 does not allow creation of another Admin through this API.

## 3. User Representation

```json
{
  "id": "user-id",
  "name": "Agent Name",
  "email": "agent@example.test",
  "role": "AGENT",
  "status": "ACTIVE",
  "version": 2
}
```

Credential hashes, reset/revocation secrets, authentication failure counters,
and other sensitive fields are never returned.

## 4. Create Agent

```json
{
  "name": "Agent Name",
  "email": "agent@example.test"
}
```

The authentication adapter generates the initial high-entropy `accessKey` and
stores only its digest. An API response must never contain the stored digest.
Normalized email addresses are unique.

## 5. Activate and Deactivate

These commands require `Idempotency-Key` and `If-Match`. Deactivation returns
`409 USER_OWNS_ACTIVE_LEADS` when the Agent owns any non-terminal Lead. The
response may provide the count but not Lead contact details. The Admin must
transfer those Leads before retrying.

Historical actor, author, owner, Timeline, and Audit references remain after
deactivation. Users are never hard-deleted in Release 1.

## 6. Notifications

`GET /notifications` supports `read=true|false`, cursor, and limit and always
uses the authenticated User as recipient. A User cannot request another User's
Notifications.

Mark-read is idempotent: marking an already read Notification succeeds without
changing the original `readAt`. Notification deletion is not supported in
Release 1.

## 7. Errors

Important codes include `LOGIN_IDENTIFIER_EXISTS`, `ROLE_NOT_SUPPORTED`,
`USER_INACTIVE`, `USER_OWNS_ACTIVE_LEADS`, `VERSION_CONFLICT`, and
`NOTIFICATION_NOT_FOUND`.
