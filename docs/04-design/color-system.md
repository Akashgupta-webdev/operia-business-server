# Release 1 Color System

## 1. Principles

Color communicates hierarchy and status but never carries meaning alone. Every
status indicator also includes text and, where helpful, an icon. Normal body
text and interactive controls must meet WCAG 2.1 AA contrast; focus indicators
must remain visible in every theme/state.

## 2. Core Tokens

| Token | Value | Use |
| --- | --- | --- |
| `color-bg` | `#F8FAFC` | Application background |
| `color-surface` | `#FFFFFF` | Cards, dialogs, tables |
| `color-text` | `#0F172A` | Primary text |
| `color-text-muted` | `#475569` | Secondary text |
| `color-border` | `#CBD5E1` | Dividers and input borders |
| `color-primary` | `#1D4ED8` | Primary actions and links |
| `color-primary-hover` | `#1E40AF` | Hover/pressed action |
| `color-focus` | `#2563EB` | Keyboard focus ring |
| `color-success` | `#15803D` | Successful/healthy state |
| `color-warning` | `#B45309` | Attention/due-soon state |
| `color-danger` | `#B91C1C` | Destructive/error state |
| `color-info` | `#0369A1` | Informational state |

Use light semantic backgrounds (`#DCFCE7`, `#FEF3C7`, `#FEE2E2`, `#E0F2FE`)
with the corresponding dark semantic text. Do not place white text on a light
semantic background.

## 3. Lead Status Mapping

| Status group | Visual token |
| --- | --- |
| `NEW`, `ASSIGNED` | Neutral / info |
| `CONTACTED`, `FOLLOW_UP` | Primary |
| `DOCUMENT_PENDING`, `QUOTATION_PREPARING` | Warning |
| `QUOTATION_SENT`, `NEGOTIATION`, `PAYMENT_PENDING` | Info |
| `WON` | Success |
| `LOST`, `CANCELLED` | Danger / neutral terminal treatment |

Status badges display the full label. Overdue Follow-ups use danger; due today
uses warning; future scheduled uses primary; completed uses success.

## 4. Interaction States

Controls define default, hover, focus, active, disabled, loading, and error
states. Disabled controls use reduced emphasis but must remain readable.
Destructive actions use danger styling only at the confirmation point, not for
ordinary navigation.

## 5. Implementation

Expose semantic design tokens rather than raw colors in components. Automated
accessibility checks must validate representative text, button, badge, focus,
error, and table combinations before release.
