# UAE VAT filing

## Scope and ownership

One ClientService with serviceCode VAT_RETURN_FILING represents one UAE tax
registration and period. Reuse ClientCompany, ClientDocument and ClientReminder.
The existing Quarterly VAT Return Filing Package label remains compatible; the
explicit period supports monthly and irregular periods too. Legacy services are
not automatically converted. This release supports standalone company registrations;
VAT groups require a future registration entity and must not be entered as separate
company filings. Package billing containers are a separate feature.

All endpoints require an active ADMIN. No client-portal or AGENT permissions are
introduced. Staff record client approval and manually submit through EmaraTax.
This system neither calculates a VAT201 return nor submits it to the authority.
The accountant uploads the calculation and enters reviewed output/recoverable-input
VAT totals. Net VAT uses exact decimal arithmetic and can be negative.

## Creation and dates

Use existing service creation with company, serviceCode, dueDate and details.vat
containing periodStart and periodEnd. Category must be Tax & Accounting and package
must be Quarterly VAT Return Filing Package. Initial status is Pending.
Standalone creation requires company; aggregate Client creation binds its newly
created company and rejects an external company reference for VAT.
The company must belong to the Client and have a 15-digit TRN. Snapshot that TRN
on the service and prevent duplicate TRN/period records with a partial unique index.
Cancelled filings retain their period reservation and may be reopened.

Dates at Client API boundaries use real dd-mm-yyyy dates (years 1900-9999).
New VAT dates are persisted as midnight UTC Date values, representing calendar
dates, not instants. Due dates are entered from EmaraTax, never inferred from a
quarter label. VAT deadline views use the Asia/Dubai calendar day. Internal
targetCompletionDate is separate. Period end must precede dueDate.

## Workflow and evidence

AWAITING_DOCUMENTS -> PREPARING -> INTERNAL_REVIEW -> AWAITING_CLIENT_APPROVAL
-> READY_TO_FILE -> FILED. prepare replaces a full reviewed calculation and resets
approval. request-review requires a working-paper document and at least one source
document. approve-review records the internal reviewer. record-approval requires
client approver name and approval evidence, and snapshots calculation revision.
return-for-correction requires a reason and clears approval before filing.
record-submission requires reference, submitted date and acknowledgment evidence;
it sets generic status Completed but leaves tax settlement independent.
cancel is allowed before filing; reopen returns cancelled work to preparation.
Filed returns cannot be edited/deleted; corrections are handled outside this MVP
and must not overwrite filed evidence. Every action stores actor, time and action.

VAT service generic PATCH is limited to fee, fee payment status, internal target
and notes, and requires expectedVersion. VAT identity/period/deadline changes use
revise-period before filing and reset review/approval. Generic status/package
changes and hard deletion are blocked. New workflows use expectedVersion in the
body; stale/retried commands return 409 rather than applying twice. This explicit
Client API contract uses version guards rather than Lead idempotency headers.
create-next-period requires a filed predecessor and explicit new dates. A unique
previousService index prevents duplicate successor creation, including races.

Service-linked uploads are retained (deletion blocked) to prevent evidence loss
and check/delete races. Link only to an existing VAT service owned by the Client.
Document purpose is SOURCE, WORKING_PAPER, APPROVAL, ACKNOWLEDGMENT or TAX_PAYMENT.
Evidence is checked for the correct service and purpose on each command.
Tax settlement records the cumulative amount paid and evidence, independently of
the service fee. Positive net tax permits UNPAID/PARTIAL/PAID; zero is NOT_DUE;
negative is CREDIT, not an automatic refund. Payment corrections require a reason.

## Reminders and dashboard

Internal reminders are service-scoped ClientReminder records. A unique service
index allows one current reminder per filing. schedule-reminder sets/reschedules
it, complete-reminder completes it. Filing/cancellation cancels pending reminders.
Multi-record actions use MongoDB transactions; a replica set is required.
No email/WhatsApp delivery worker is introduced.
vatDue counts unfiled, uncancelled VAT services due through 60 days from today's
Dubai date, including overdue work. It is global like inventory counts and ignores
the legacy expiry filters. corporateTax remains unchanged.

## Deployment

Additive optional fields require no rewrite of legacy records. Before enabling
new writes run scripts/migrate-vat-indexes.js with MONGODB_URI to create indexes
without dropping unrelated indexes. Back up first; duplicate new VAT records cause
index creation to fail visibly and require investigation. Do not guess periods/TRNs
for legacy package-only services. No government credentials are stored.
