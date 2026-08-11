# Renewal Workflow

## Status

Deferred; not part of Release 1 Lead Management.

Before implementation, product approval must define:

- the Policy states and dates that make renewal eligible;
- renewal-window thresholds and agency timezone;
- reminder recipients, channels, cadence, suppression, and escalation;
- owner assignment and transfer;
- renewal states and terminal outcomes;
- relationship between old and resulting Policy;
- lapsed, cancelled, rejected, and late-renewal behavior;
- Timeline, Audit, Notification, and reporting effects.

Renewal is a Policy/Customer workflow. It must not reopen the originating Lead
or store `RENEWAL_DUE` on a Lead.
