# Release 1 Authentication and Authorization

## 1. Scope

Release 1 supports authenticated `ADMIN` and `AGENT` users for one insurance
agency. Authentication proves identity; authorization determines whether that
identity may perform an action on a particular record.

## 2. Identity Rules

- Every protected action has one active User identity.
- User email addresses are unique after normalization.
- Credentials are never stored or logged in plaintext.
- A deactivated User cannot start a new session or receive a new assignment.
- Deactivation retains historical authorship, ownership, Timeline, and Audit
  references.
- Deactivating an Agent is rejected while the Agent owns active Leads unless
  those Leads are transferred as part of an explicit administrative workflow.

ADR-003 selects access-key authentication with short-lived access JWTs and
rotating refresh JWTs in `HttpOnly` cookies. Sessions expire, a new login or
refresh revokes the previously stored refresh token, and protected endpoints
reject missing, invalid, expired, or revoked credentials.

## 3. Authorization Principles

1. Deny by default.
2. Check role and record scope for every command and query.
3. Server-side authorization is mandatory; hidden UI controls are not security.
4. An Agent owns no implicit access through a former assignment.
5. Aggregate counts, search suggestions, duplicate warnings, and exports follow
   the same record scope as detail views.
6. Return a non-disclosing not-found response when revealing a Lead's existence
   would expose another Agent's data.

## 4. Permission Matrix

| Capability | Admin | Agent |
| --- | --- | --- |
| View active Users | Allowed | Own profile only |
| Create/activate/deactivate Agent | Allowed | Denied |
| View Lead | All Leads | Currently assigned Leads |
| Create Lead | Unassigned or assigned to active Agent | Assigned to self |
| Edit Lead contact/source fields | All non-terminal Leads | Own non-terminal Leads |
| Assign unassigned Lead | Allowed | Denied |
| Transfer Lead | Allowed | Denied |
| Perform valid non-admin status transition | Allowed | Own Lead |
| Mark Lead Lost | Allowed | Own Lead |
| Cancel or reopen Lead | Allowed | Denied |
| Schedule/complete/cancel Follow-up | Any accessible active Lead | Own active Lead |
| Add Note | Any accessible Lead | Own Lead |
| View Timeline | Any Lead | Own Lead |
| View Audit Log | All Leads | Denied in Release 1 |
| View dashboard/reporting | All permitted agency data | Own assigned data |
| Read assignment Notification | Own Notifications | Own Notifications |

Terminal Leads are read-only except for Admin reopen where the workflow permits
it. Notes cannot be added to a terminal Lead in Release 1.

## 5. Ownership Changes

Assignment and transfer authorization is evaluated at command time. When a
Lead moves from Agent A to Agent B:

- Agent A immediately loses access after commit;
- Agent B gains access after commit;
- open Follow-ups move to Agent B;
- historical performer and author references remain unchanged;
- the transfer reason is audited;
- Agent B receives an in-app Notification.

## 6. Field-Level Protection

- Role, activation state, owner, Lead status, terminal reasons, versions, and
  audit fields cannot be changed by generic update requests.
- Credentials, credential hashes, session secrets, and reset tokens are never
  returned from an API.
- Audit before/after snapshots must omit credentials and minimize unnecessary
  personal information.
- Duplicate detection returns only matches already visible to the caller. An
  Agent is told that an inaccessible duplicate may exist but receives no
  identifying details.

## 7. Security Events

Successful and failed authentication, logout/revocation, User activation
changes, denied privileged actions, assignment/transfer, and all Lead mutations
must be security-logged. Business mutations also create the Audit Log entries
defined by the History module. Authentication failure responses must not reveal
whether a login identifier exists.

## 8. Test Requirements

Authorization tests must cover each permission row, ownership before and after
transfer, inactive users, terminal records, list/filter/count leakage,
duplicate-warning leakage, and direct endpoint access independent of the UI.
