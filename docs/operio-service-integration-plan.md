# Operio client service integration plan

Status: proposal for sequential implementation; no application behavior changed.
Prepared from the supplied service description and repository inspection on 2026-09-13.

## Intended outcome

From a Client, staff can select a service, identify its company/applicant, record
the reference and relevant dates, attach documents, and see the next action.
Forms show approximately 8-12 relevant inputs, with optional details collapsed.
This is operational tracking; government application submission and automatic
legal/tax deadline calculation are outside this proposal.

## Repository findings

- `src/modules/clients/models/clientService.model.js` already defines all 44
  packages across five categories. Keep these existing package/category values.
- `clientService.service.js` and `clientService.controller.js` implement create,
  patch, and hard delete. Routes are restricted to active ADMIN users.
- Services currently store client, category, package, status, packagePrice,
  paymentStatus, targetCompletionDate, and notes. There is no package/category
  pairing validation, company/applicant link, staff assignment, or detail schema.
- `clientBody.validator.js` exports the create schema reused by standalone
  service creation. Aggregate Client creation also inserts services; both paths
  must receive the same business validation, including database reference checks.
- `clientDetail.service.js` already returns services, documents, and reminders.
- ClientCompany stores current licence, establishment, VAT and corporate tax
  identifiers. Client and ClientMember store current identity/visa information.
- ClientDocument and ClientReminder currently reference only the Client.
  Cloudinary upload and cleanup services already exist and should be reused.
- `clientRenewal.service.js` combines six collections but excludes ClientService.
  It is an expiry listing, not a workflow or a notification sender.
- Dashboard expiry coverage differs from the renewal list: documents and
  establishment cards are not listed as KPI sources. VAT and corporate-tax due
  KPIs currently return zero, as documented.
- Dates in Client APIs use dd-mm-yyyy. The shared schema regex checks format,
  not calendar validity; the renewal query separately excludes impossible dates.
- Models use optimistic concurrency and responses include ETags; service PATCH
  does not accept an expected client version. ETags alone do not prevent a stale
  browser form from overwriting newer data.
- General product/database documents describe a different or deferred design.
  In particular, collections.md describes service-scoped documents/reminders,
  which are not the current Client models.
- Older tests such as client-service.service.test.js and
  client-service.validator.test.js import absent files. This is a static finding;
  the test suite has not been run for this planning task.

## Proposed data boundaries

Keep one ClientService collection. One record means one engagement or work cycle;
repeat filings and renewals create new records linked to the preceding cycle.

| Location | Proposed responsibility |
| --- | --- |
| Client | Existing customer identity and contact information |
| ClientCompany / ClientMember | Current company or applicant facts |
| ClientService | Work, service reference, dates, owner, package-specific facts |
| ClientDocument | Existing uploads, with an optional service reference |
| ClientReminder | Scheduled action and its state, with an optional service reference |
| Package catalog | Package/category mapping, visible fields, labels and validation metadata |

Add optional `company`, `member`, `assignedTo`, `referenceNumber`, `startDate`,
`completionDate`, `issueDate`, `expiryDate`, `dueDate`, `nextFollowUpDate`,
`details`, and later `previousService` to ClientService. The Client itself is
the default applicant; a member identifies a different beneficiary. Document
the supported combinations of company and member. Every linked entity must
belong to the service's Client. Assignment must reference an eligible active User.

Use a checked-in catalog under `clients/config/` initially, with stable package
codes and existing display strings. Avoid a configurable form-builder database.
Give `details` strict package-specific schemas; reject unknown keys and invalid
category/package combinations. PATCH must validate the merged saved record,
especially when changing package or category. Do not silently discard details.

Do not duplicate company/applicant names in every service. Read them through
references. Current master facts remain authoritative; service outcome values
can be historical snapshots. Completion must explicitly update approved master
fields in a transaction, never silently synchronize them during generic edits.
Before that workflow exists, master facts continue through their existing APIs.

## Dates and status

- Preserve dd-mm-yyyy at existing API boundaries. Strictly validate real dates.
  Define a parsed/indexable persistence representation for new deadline queries;
  do not sort dd-mm-yyyy strings lexicographically. Document migration and UTC
  date-only semantics before adding shadow fields or converting storage.
- `targetCompletionDate`: internal target for completing work; preserve it.
- `startDate` / `completionDate`: actual work dates.
- `issueDate`: authority/document issue date, which can differ from completion.
- `expiryDate`: when the resulting licence/visa/registration expires.
- `dueDate`: filing or other obligation deadline; not an expiry.
- `nextFollowUpDate`: next planned staff action, not the government deadline.
- Keep existing Pending, In Progress, Completed, Cancelled values. Use Pending
  for newly started tracking unless a separate New state is later selected.
- Derive renewal-due, expired, deadline-overdue and follow-up-due indicators.
  A Completed service can have an expired result without losing its work status.
- Specify applicable date ordering per package. Do not globally require an
  expiry to follow work completion: late renewal work can concern an expired item.

Example field selection (common fields are not repeated inside details):

| Package | Subject | Reference | Dates | Extra details |
| --- | --- | --- | --- | --- |
| Trade Licence Renewal | Company | Licence/application reference | Issue, expiry, follow-up | Licensing authority |
| Employment Visa | Member + optional company | Visa/UID | Issue, expiry, follow-up | Only additional facts needed for tracking |
| Quarterly VAT Return | Company | Filing reference; TRN from company | Due, completion, follow-up | Tax period |
| Financial Audit | Company | Optional engagement reference | Due, completion | Financial year |
| Trademark Registration | Client/company | Registration number | Issue, expiry, follow-up | Trademark name |

## Sequential implementation checklist

### 1. Reconcile requirements and approve the field matrix

- [ ] Update product requirements to describe Operio service tracking and its
  relationship to the existing insurance scope; reconcile conflicting database docs.
- [ ] Write a workflow and a 44-package matrix mapping every supplied field to
  a master field, common service field, or validated detail field.
- [ ] Specify lifecycle transitions, required-at-create vs required-at-complete
  fields, date semantics, subject combinations and renewal history rules.
- [ ] Keep current ADMIN-only access initially. Decide separately whether AGENT
  users should access assigned services, and what client information they may see.
- [ ] Select reminder recipients, timezone, lead times and acknowledgement rules.
  Proposed first version: internal task list; outbound channels in a later phase.
- [ ] Run the test baseline and reconcile obsolete tests against current contracts.

Done when the contracts and baseline are understood, with no contradictory
service ownership or date definitions. Do not remove old test coverage blindly.

### 2. Add the catalog and service data foundation

- [ ] Add the package catalog and strict reusable detail/date validators.
- [ ] Extend the existing model with optional fields and appropriate indexes.
- [ ] Add a read-only catalog endpoint for forms, using current auth conventions.
- [ ] Plan an idempotent migration: preserve existing strings/statuses, map only
  known packages, and report mismatched or incomplete records for review.
- [ ] Test invalid package/category pairs, unknown details, real calendar dates,
  optional/null behavior, and reading legacy records.

Done when every package has a defined small form and old records remain readable.

### 3. Extend create, patch and detail APIs

- [ ] Reuse clientService services, controllers and routes; share validation and
  service creation logic with aggregate Client creation, accepting its session.
- [ ] Validate company/member ownership and eligible assignees in services.
  Define how aggregate creation links its newly created company/member records;
  do not accept arbitrary cross-client IDs or silently infer ambiguous subjects.
- [ ] Add service detail and paginated service listing endpoints with filters
  for client, package, category, work status, owner and relevant dates.
- [ ] Define a backward-compatible expected-version rollout and conflict response.
- [ ] Test standalone/aggregate parity, cross-client rejection, stale updates,
  transaction rollback and existing response envelopes.

Done when a service can be recorded and retrieved for an existing client with
the correct subject and minimal package-specific information.

### 4. Connect service documents and reminder tasks

- [ ] Add optional service links to existing document/reminder models and APIs;
  verify client ownership and preserve unlinked legacy records.
- [ ] Reuse the existing upload/cleanup service; do not introduce another uploader.
- [ ] Add reminder scheduling, rescheduling, completion and cancellation actions.
  Use reminder records as scheduling truth and maintain nextFollowUpDate as a
  derived/cache projection once reminders are enabled; avoid two editable sources.
- [ ] Define deletion behavior before activating links. Proposed rule: block
  deletion of services with linked records/history and support cancellation;
  retain existing deletion for eligible unlinked records.
- [ ] Test ownership, upload compensation, rescheduling, cleared dates and deletion.

Done when staff can see documents and the next actionable task for a service.

### 5. Build deadline views and service KPIs

- [ ] Add a service deadline view covering expiry, filing due date and follow-up;
  keep these deadline types distinguishable in rows and filters.
- [ ] Preserve the existing expiry-list contract. Add service sources only with
  documented source values and compatibility coverage, or expose a separate API.
- [ ] Define canonical obligations so master records, service snapshots and
  documents do not accidentally produce duplicate service tasks or KPI counts.
  Preserve the existing documented document-row behavior in the old list.
- [ ] Reconcile list/KPI source coverage and implement VAT/corporate-tax due
  counts from dated unfinished filing work, not registration records alone.
- [ ] Test boundaries, completed/cancelled work, pagination, deterministic sorting,
  absent dates and multiple cycles with a fixed clock.

Done when a saved deadline appears in the correct queue and its defined KPI.

### 6. Add completion and renewal history

- [ ] Implement documented completion/renewal actions with atomic approved master
  updates, actor/event history, version checks and retry protection.
- [ ] Create linked new service cycles; preserve prior dates, references and work.
- [ ] Retire or supersede obsolete tasks without erasing reminder history.
- [ ] Test duplicate renewal requests, transaction failure and historical reads.

Done when renewing a licence or filing another period preserves previous work.

### 7. Add automatic reminder delivery if selected

- [ ] Add a durable worker/scheduler and notification/outbox persistence; none
  should be assumed to exist from the current reminder model.
- [ ] Use persisted deduplication keys and retry state; rescheduling/cancellation
  must invalidate obsolete pending delivery work. External calls stay outside
  database transactions, with provider idempotency where available.
- [ ] Start with the approved internal notification experience; integrate email
  or WhatsApp only after recipients, channels and provider configuration are defined.
- [ ] Test worker restarts, retries, duplicate claims and inactive assignees.

Done when due tasks produce the selected notification with observable retries
and without normal repeated-worker execution producing duplicate notifications.

## Implementation conventions and verification

Keep the existing clients/{models,validators,services,controller,errors,utils}
layout. Database operations belong in services; controllers retain try/catch,
safe logs and standard errors. Add two-line comments to important functions.
Place proven functions reused across more than two modules in shared; avoid
building a generic framework for a single service module.

Each phase includes its workflow/API/data documentation and focused behavioral
tests. Use `node --test` for the repository suite; exercise real MongoDB
transactions/concurrency in integration coverage rather than relying only on
mocked model methods. Establish available quality tools from package.json:
currently it has test/start/dev scripts, but no lint or type-check script.

Suggested first vertical slice after steps 1-3: Trade Licence Renewal and
Quarterly VAT Return. Together they validate expiry tracking and filing deadlines
without assuming all services behave like renewable licences.

## Implemented VAT slice

The UAE VAT workflow now implements service periods, company/assignee links,
review/approval/submission, separate tax settlement, retained evidence, internal
reminders, recurrence and vatDue. See 06-workflows/vat-filing.md and
05-api/client-vat-filing.md. The remaining 44-package catalog work and outbound
notification delivery remain proposals.
