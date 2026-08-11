# Release 1 UI and Workflow Guidelines

## 1. Experience Goals

The interface should answer three questions quickly: who owns this Lead, what
stage is it in, and what happens next? Screens support business actions rather
than exposing database records.

## 2. Information Architecture

```text
Authenticated Application
|- Dashboard
|- Leads
|  |- Worklist / search
|  `- Lead detail
|     |- Overview and next action
|     |- Follow-ups
|     |- Timeline
|     `- Notes
|- Notifications
`- Users (Admin only)
```

Audit history is available to Admin from Lead detail. Deferred modules must not
appear as active navigation.

## 3. Dashboard

Admin sees permitted counts by status/owner plus due and overdue Follow-ups.
Agent sees only owned Leads and Follow-ups. Every metric links to the filtered
worklist and displays its definition or tooltip. Avoid decorative charts when a
number or ranked list supports action more clearly.

## 4. Lead Worklist

Default columns: Lead, contact, status, owner (Admin), source, next Follow-up,
and last updated. Put overdue first, then upcoming, then records with no next
Follow-up. Filters remain visible and are reflected in the URL where practical.
Mobile layouts use cards without removing status, owner, or next action.

## 5. Lead Detail

Keep identity, status, owner, next action, and version/currentness visible at
the top. Present named actions based on server-provided permissions and allowed
transitions. Timeline is business-readable; it must not be mixed with raw audit
field changes. Notes and Follow-ups are visually distinct.

## 6. Forms and Feedback

- Use plain business labels and examples.
- Mark required fields in text, not only color.
- Validate on submit and after a visited field changes; do not interrupt initial
  typing.
- Preserve input after recoverable errors.
- Confirm transfer, terminal outcomes, and reopen actions with consequences.
- Show a committed success only after the server transaction succeeds.
- On version conflict, preserve the user's draft and offer to review the current
  record; never overwrite silently.

## 7. Time

Display times in the configured agency timezone with an unambiguous date and
timezone indicator. Store/send UTC. Relative text such as “in 2 hours” is
secondary to an exact accessible time. Overdue status is computed, not saved by
the screen.

## 8. Responsive and Accessible Behavior

Support keyboard-only navigation, logical headings, landmarks, focus return
after dialogs, labeled controls, announced errors/status changes, 200% zoom,
reflow at narrow widths, and reduced motion. Do not require hover or drag.
Touch targets should be at least 44 by 44 CSS pixels.

## 9. Empty, Loading, and Error States

Every view defines loading, empty, filtered-empty, authorization, offline/retry,
and unexpected-error states. Empty states explain the next permitted action.
Errors include a correlation reference where support may need it and never show
technical internals.

## 10. Privacy

Show only contact information needed for the workflow. Avoid personal data in
page titles, URLs, analytics events, toast messages, and client logs. Masking
rules, if required, must be consistent rather than improvised per screen.
