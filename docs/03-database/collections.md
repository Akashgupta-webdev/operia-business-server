# Release 1 Logical Data Model

## 1. Purpose

This document defines persistence responsibilities and constraints without
selecting a relational or document database. “Collection” means a logical set
of records; a physical implementation may use tables.

Common rules:

- identifiers are opaque and immutable;
- timestamps are stored in UTC;
- mutable aggregate roots have an integer `version`;
- normalized contact fields support matching but are not displayed;
- Timeline and Audit records are append-only;
- historical actor references survive User deactivation.

## 2. Users

| Field | Meaning / constraint |
| --- | --- |
| `id` | Immutable User identifier |
| `name` | Required business display name |
| `email` | Required normalized unique email |
| `role` | `ADMIN` or `AGENT` |
| `status` | `ACTIVE` or `INACTIVE` |
| `accessKey` | SHA-256 digest of a generated high-entropy login key; never returned |
| `refreshKeyHash` | Digest of the current rotating refresh token; never returned |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC audit timestamps |

An inactive Agent cannot own active Leads. Deactivation is blocked until those
Leads are transferred.

## 3. Leads

| Field | Meaning / constraint |
| --- | --- |
| `id` | Immutable Lead identifier |
| `displayName` | Required prospect/person/organization name |
| `phone`, `normalizedPhone` | Optional contact pair |
| `email`, `normalizedEmail` | Optional contact pair |
| `source` | Required configured source code |
| `productInterest` | Optional plain category/reference; not an Insurance Plan |
| `ownerId` | Nullable only while status is `NEW` |
| `status` | State from `lead-flow.md` |
| `lossReason`, `lossExplanation` | Present only for current `LOST` state |
| `cancellationReason` | Present only for current `CANCELLED` state |
| `wonAt`, `successNote` | Present for `WON` |
| `documentPendingDetail` | Current stage context when relevant |
| `paymentMilestone`, `paymentExpectedAt` | External milestone description only |
| `nextFollowUpAt` | Derived/cache of earliest `SCHEDULED` Follow-up; nullable |
| `version` | Increments on every Lead aggregate mutation |
| `createdBy`, `createdAt`, `updatedBy`, `updatedAt` | Actor and UTC timestamps |

At least one of phone or email is required. Generic updates cannot modify
owner, status, terminal reason fields, `nextFollowUpAt`, version, or audit
fields. Historical values belong in the Audit Log, not repeated arrays inside
the Lead record.

## 4. Follow-ups

| Field | Meaning / constraint |
| --- | --- |
| `id`, `leadId` | Follow-up and parent Lead |
| `ownerId` | Agent currently responsible for a scheduled Follow-up |
| `status` | `SCHEDULED`, `COMPLETED`, `CANCELLED`, or `MISSED` |
| `scheduledAt` | Required UTC due time |
| `communicationMethod` | Configured code such as `PHONE`, `EMAIL`, `MEETING`, `MESSAGE` |
| `intendedNextAction` | Required when scheduled |
| `discussionSummary`, `outcome` | Required when completed |
| `reason` | Required when cancelled or missed |
| `completedBy`, `completedAt` | Completion actor and time |
| `version` | Optimistic concurrency |
| `createdBy`, `createdAt`, `updatedAt` | Traceability |

Overdue is derived from `status = SCHEDULED` and `scheduledAt < now`; it is not
stored. A transfer updates `ownerId` only for scheduled Follow-ups. Completed
records preserve the performer.

## 5. Notes

| Field | Meaning / constraint |
| --- | --- |
| `id`, `leadId` | Note and parent Lead |
| `body` | Required bounded text |
| `authorId`, `createdAt` | Immutable author and time |

Release 1 Notes are append-only. A correction is a new Note that references
the earlier Note; hard deletion is not supported.

## 6. Timeline Entries

| Field | Meaning / constraint |
| --- | --- |
| `id`, `leadId` | Event and Lead |
| `eventType` | Stable business event code |
| `occurredAt` | Business event time |
| `actorId` | User or documented system actor |
| `summary` | User-safe business description |
| `businessData` | Minimal structured values needed to explain the event |
| `correctionOfId` | Optional prior Timeline entry being corrected |
| `commandId` | Links all effects of one command |

Timeline records are immutable and contain no full credential, Note, or contact
snapshots.

## 7. Audit Log

| Field | Meaning / constraint |
| --- | --- |
| `id`, `commandId` | Audit record and originating command |
| `actorId`, `action` | Who and what |
| `targetType`, `targetId` | Affected record |
| `occurredAt` | UTC time |
| `before`, `after` | Allow-listed changed fields only |
| `correlationId` | Request trace |
| `reason` | Required for privileged/terminal actions where applicable |

Audit Log entries are immutable, access-restricted, and excluded from generic
record APIs.

## 8. Notifications

| Field | Meaning / constraint |
| --- | --- |
| `id`, `recipientId` | Notification and receiving User |
| `type` | `LEAD_ASSIGNED` or `LEAD_TRANSFERRED` |
| `leadId` | Business context |
| `message` | Safe display text |
| `createdAt`, `readAt` | UTC lifecycle times |
| `commandId` | Uniqueness/idempotency link |

One recipient/type/command combination creates at most one Notification.

## 9. Idempotency Records

Store actor, operation, idempotency key, canonical request hash, response
reference, status, and expiry. The uniqueness boundary is actor + operation +
key. A reused key with a different request hash is a conflict.

## 10. Transaction Boundaries

The following persist atomically:

- Lead creation and initial history;
- assignment/transfer, history, open Follow-up ownership, and Notification;
- status transition, terminal Follow-up cancellation, and history;
- Follow-up completion, optional next Follow-up, Lead next-action update,
  Timeline, and Audit;
- Note creation and Audit.
- complete Client Service creation, including its optional Company, Document,
  Payment, and Reminder records.

Physical retention, encryption, backup, and recovery settings belong to the
deployment/security design.

## 11. Companies

Companies represent insured or prospect business entities. They are not the
system's future multi-tenant Organization boundary.

| Field | Meaning / constraint |
| --- | --- |
| `client` | Required reference to the owning Client record's MongoDB `_id` |
| `companyId` | Immutable unique identifier allocated as `comp-{sequence}` |
| `companyName`, `tradeName`, `legalName` | Required display name and optional trading/legal names |
| `companyType`, `freeZoneName` | `MAINLAND`, `FREE_ZONE`, or `OFFSHORE`, plus optional free-zone name |
| `licence` | Optional number, activity, issue date, and expiry date |
| `establishment` | Optional card number and card expiry date |
| `vatTrnNumber`, `corporateTaxRegistrationNumber` | Optional tax registration identifiers |
| `companyEmail`, `companyMobile`, `address` | Optional company contact details |
| `bankName`, `accountName`, `iban`, `accountNumber` | Optional bank account details |
| `companyStatus` | `ACTIVE`, `UNDER_FORMATION`, `SUSPENDED`, `EXPIRED`, or `CLOSED` |
| `notes` | Array of bounded note strings |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC timestamps |

## 12. Counters

Counters provide atomic numeric sequences for modules that require an
incrementing sequence value. Public resource identifiers remain opaque.

| Field | Meaning / constraint |
| --- | --- |
| `name` | Required, immutable, normalized sequence name; unique across counters |
| `count` | Non-negative safe integer containing the last allocated value |
| `createdAt`, `updatedAt` | UTC timestamps |

Allocating a value atomically increments the named counter. Separate normalized
names have independent sequences, and counter values must not be reused after
allocation.

## 13. Services

Services are Client- and Company-scoped records categorized by the work being
performed. Their dynamic detail shape stores supplied service facts. The
status vocabulary records progress but does not by itself authorize a status
transition or generic API update.

| Field | Meaning / constraint |
| --- | --- |
| `company` | Optional Company MongoDB `_id`; omitted for an individual Client |
| `client` | Required reference to the related Client MongoDB `_id` |
| `category` | Required category from the approved Service category vocabulary below |
| `status` | `NOT_STARTED`, `IN_PROGRESS`, `SUBMITTED`, or `COMPLETE`; defaults to `NOT_STARTED` |
| `detail` | Required non-empty object containing dynamic field/value pairs |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC timestamps |

Approved Service category codes and display labels:

| Code | Display label |
| --- | --- |
| `TRADE_LICENCE_NEW_RENEWAL_AMENDMENT` | Trade Licence (New / Renewal / Amendment) |
| `VAT_REGISTRATION` | VAT Registration |
| `VAT_DEREGISTRATION` | VAT Deregistration |
| `CORPORATE_TAX_REGISTRATION` | Corporate Tax Registration |
| `ESTABLISHMENT_CARD_NEW_RENEWAL` | Establishment Card (New / Renewal) |
| `SIGNATURE_CARD_NEW_RENEWAL` | Signature Card (New / Renewal) |
| `SIGNATURE_CARD_ACTIVATION` | Signature Card Activation |
| `BANK_ACCOUNT_ASSISTANCE` | Bank Account Assistance |
| `VAT_FILING_QUARTERLY_MONTHLY` | VAT Filing (Quarterly / Monthly) |
| `VAT_PAYMENT_TRACKING` | VAT Payment Tracking |
| `CORPORATE_TAX_FILING_ANNUAL` | Corporate Tax Filing (Annual) |
| `CORPORATE_TAX_PAYMENT_TRACKING` | Corporate Tax Payment Tracking |
| `INVESTOR_PARTNER_EMPLOYEE_VISA_NEW` | Investor / Partner / Employee Visa (New) |
| `VISA_RENEWAL` | Visa Renewal |
| `VISA_CANCELLATION` | Visa Cancellation |
| `STATUS_CHANGE` | Status Change |
| `MEDICAL_TEST` | Medical Test |
| `EMIRATES_ID` | Emirates ID |
| `HEALTH_INSURANCE` | Health Insurance |
| `ILOE_INSURANCE` | ILOE Insurance |
| `BENEFICIARY_UPDATE` | Beneficiary Update |
| `TYPING_SERVICES` | Typing Services |
| `IMMIGRATION_LABOUR_SERVICES` | Immigration / Labour Services |
| `OTHER_CUSTOM_SERVICE` | Other / Custom Service |

## 14. Documents

The Document collection stores Service-scoped and optionally Company-scoped document metadata.
It stores a URL, not file bytes. Document authorization, file validation,
retention, versioning, and deletion remain deferred under `BR-DOC-003`.

| Field | Meaning / constraint |
| --- | --- |
| `company` | Optional Company MongoDB `_id`; omitted for an individual Client |
| `service` | Required reference to the related Service MongoDB `_id` |
| `documentUrl` | Required bounded HTTP or HTTPS URL |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC timestamps |

## 15. Payments

Payments record monetary facts associated with a Company Service. They do not
process money or establish accounting behavior. Amounts use exact decimal
storage rather than binary floating point. Method and status are normalized
uppercase strings until their business vocabularies are separately approved.

| Field | Meaning / constraint |
| --- | --- |
| `company` | Optional Company MongoDB `_id`; omitted for an individual Client |
| `service` | Required reference to the related Service MongoDB `_id` |
| `governmentFee`, `serviceFee` | Required non-negative decimal amounts |
| `totalAmount`, `amountReceived` | Required non-negative decimal amounts |
| `paymentMethod`, `paymentStatus` | Required bounded uppercase values; no lifecycle is inferred |
| `paymentDate` | Required UTC payment date/time |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC timestamps |

## 16. Reminders

Reminders store due-date tracking for a Company Service. These records are not
Lead Follow-ups or Renewal Reminders and do not define notification delivery,
cadence, recipients, or escalation behavior.

| Field | Meaning / constraint |
| --- | --- |
| `company` | Optional Company MongoDB `_id`; omitted for an individual Client |
| `service` | Required reference to the related Service MongoDB `_id` |
| `dueDate` | Required UTC due date/time |
| `reminderBefore` | Required non-negative whole number of days |
| `followUpsDate` | Required UTC follow-up date/time |
| `notes` | Optional bounded contextual text |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC timestamps |

## 17. Expenses

Expenses store operational outgoings used by the Profit and Loss module.
Amounts use exact decimal storage and dates use UTC date values.

| Field | Meaning / constraint |
| --- | --- |
| `expenseTitle` | Required bounded display title |
| `expenseCategory` | Required approved operational-expense category |
| `expenseAmount` | Optional non-negative exact decimal amount |
| `expenseDate` | Optional UTC expense date |
| `paymentMethod` | Optional approved payment method |
| `vendorName` | Optional bounded vendor name |
| `receiptReference` | Optional bounded receipt or transaction reference |
| `notes` | Optional bounded contextual text |
| `version` | Optimistic concurrency |
| `createdAt`, `updatedAt` | UTC timestamps |

Monthly Profit and Loss reporting groups Client Service package prices by
Service category and Expense amounts by Expense category. Accounts receivable
is derived from each Client Payment as the non-negative difference between
`totalBilled` and `amountReceived`; it is not stored as a separate field.
