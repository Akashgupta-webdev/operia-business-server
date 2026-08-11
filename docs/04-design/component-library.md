# Release 1 Component Library

## 1. Purpose

Components provide consistent, accessible behavior for the Lead Management
workflows. Business permissions and state rules still come from the server;
components may guide but never authorize an action.

## 2. Foundations

- Typography, spacing, radius, elevation, and semantic color tokens
- Button, icon button, link, badge, divider, and skeleton
- Text, phone, email, date/time, select, combobox, textarea, and checkbox input
- Form field with label, hint, required state, inline error, and described-by
  association
- Dialog, confirmation dialog, drawer, popover, tooltip, toast, and inline alert

Every interactive component supports keyboard operation, visible focus, screen
reader naming, loading, disabled, and error states.

## 3. Data Components

| Component | Required behavior |
| --- | --- |
| Data table | Server pagination/sort, column labels, empty/error/loading states |
| Filter bar | Applied-filter chips, clear all, URL/shareable state where practical |
| Search input | Debounced bounded input; no unauthorized suggestion leakage |
| Pagination | Cursor-aware next/previous controls |
| Status badge | Text plus semantic color |
| User/owner chip | Display name and active/inactive indicator |
| Timeline | Chronological event, actor, time, summary, correction link |
| Audit change view | Admin-only allow-listed before/after fields |

## 4. Lead Workflow Components

- `LeadSummary`: contact, source, owner, status, next action, updated time.
- `LeadStatusStepper`: current state and only server-provided valid next actions.
- `AssignmentDialog`: active Agent search and assignment confirmation.
- `TransferDialog`: new Agent plus mandatory reason.
- `TransitionDialog`: renders fields required for the chosen state transition.
- `TerminalActionDialog`: clearly separates Lost from Cancelled.
- `ReopenDialog`: active Agent and mandatory reason.
- `FollowUpComposer`: due time, method, intended action.
- `FollowUpCompletion`: summary, outcome, optional next Follow-up.
- `NoteComposer`: contextual text with explicit “not a completed interaction”
  treatment.
- `DuplicateWarning`: visible matches, reason for warning, and explicit
  create-separate confirmation.

## 5. Composition Rules

Dialogs keep entered values after recoverable validation errors. Submit buttons
prevent duplicate submission while preserving safe idempotent retry.
Server-provided errors appear near the relevant field and in a summary for
screen-reader navigation. Terminal or unauthorized records render read-only
rather than merely disabling selected fields.

## 6. Component Acceptance

Each component has documented props/events, examples for all states, keyboard
tests, accessibility checks, responsive examples, and visual regression
coverage for critical variants.
