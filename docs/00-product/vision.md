# Insurance CRM Product Vision

## Purpose

Insurance CRM is a business management platform for insurance agencies and
brokers. It manages the customer journey from lead generation through
quotation, policy issuance, renewal, and claim support.

The product is not a collection of CRUD screens. It models real business
workflows, preserves their history, and helps Admins and Agents take the right
action at the right time.

## Vision Statement

Enable insurance agencies and brokers to manage every customer relationship
through one reliable, traceable, and workflow-driven system, so opportunities
are progressed consistently and customers receive continuous service throughout
the insurance lifecycle.

## Problem

Insurance work spans repeated follow-ups, document collection, quotations,
payments, policies, renewals, and claim-related assistance. When these
activities are fragmented or treated as isolated records:

- Leads can be missed or handled inconsistently.
- Ownership and next actions become unclear.
- Customer context is lost between interactions.
- Policy and renewal milestones are difficult to track.
- Business progress and system actions cannot be reliably audited.

The CRM provides a shared operating context for this work.

## Target Users

The current product serves:

- **Admin** — manages administrative operations such as lead assignment.
- **Agent** — progresses assigned leads and supports customers across
  follow-ups, quotations, policies, renewals, and claims.

Branch Manager, Sales Manager, Telecaller, Accountant, and Super Admin are
future role candidates. They are not part of the current authorization model.

## Product Value

The product should:

- Give every Lead clear ownership, status, history, and next action.
- Preserve customer context across the full insurance relationship.
- Make follow-ups complete business records rather than simple reminders.
- Represent business progress in a Timeline and system actions in an Activity
  or Audit Log.
- Support business actions such as assigning a Lead, scheduling a Follow-up,
  generating a Quotation, issuing a Policy, and renewing a Policy.
- Reduce missed follow-ups and renewal opportunities.
- Provide reliable traceability for operational and audit needs.

## Product Principles

1. **Business first** — document purpose and rules before technical design.
2. **Workflow driven** — design around triggers, actions, outcomes, and the
   next business step.
3. **Explicit state** — lifecycles use documented state machines, not arbitrary
   status updates.
4. **Complete history** — meaningful business events and system actions remain
   distinguishable and traceable.
5. **Clear boundaries** — a Lead is not a Customer, a Follow-up is not a
   reminder, and a Timeline is not an Activity Log.
6. **Modular growth** — the initial system establishes foundations that can
   support later modules and roles without prematurely implementing them.
7. **Documentation led** — maintained documentation is the source of truth for
   developers and Codex.
8. **Evolution without premature complexity** — keep organization-dependent
   concerns isolated so future multi-tenancy can be introduced incrementally,
   without implementing multi-tenant behavior in the first release.

## Product Scope

The long-term product direction includes:

- Lead and Customer management
- Lead assignment and Follow-ups
- Quotations and insurance Documents
- Policies and Renewals
- Claim support
- Notes, Tasks, and Notifications
- Users and authorization
- Timelines, Activity Logs, and Audit Logs
- Reports and dashboard analytics

The initial version should implement only features selected by approved
requirements. Architectural extensibility does not make every long-term module
part of the first release.

The first release is a production-ready CRM for one insurance agency. Its
priorities are mature business workflows, clean architecture, comprehensive
documentation, and deterministic context for AI-assisted development.

### Release 1 Product Slice

Release 1 establishes the Lead Management operating loop:

- User identity and the Admin and Agent roles
- Lead capture, ownership, assignment, and transfer
- A controlled Lead state machine from `NEW` to a terminal outcome
- Follow-ups, Notes, and an explicit next action
- In-app assignment and transfer Notifications
- A user-facing Business Timeline and a separate Audit Log
- Lead search, filtering, workload views, and basic operational counts

Quotation, Customer conversion, Policy, Renewal, Claim, file storage, outbound
messaging, and payment processing remain later product slices. Release 1 may
record where a Lead is in the sales journey, but it must not fabricate records
owned by those deferred modules.

## Business Journey

```text
Potential Customer
    -> Lead and Assignment
    -> Contact and Requirement Gathering
    -> Follow-ups and Documents
    -> Quotation and Negotiation
    -> Payment Milestone
    -> Customer and Policy
    -> Renewal
    -> Claim Support
```

This is the product-level journey, not a finalized Lead state machine. Entity
transitions and conversion rules must be defined in their workflow documents.

## Product Boundaries

The CRM:

- Supports the agency or broker; it is not the Insurance Company.
- Supports claim-related service; it does not adjudicate or pay Claims.
- Records a payment milestone but does not imply payment processing or
  accounting functionality without explicit requirements.
- Must not treat proposed roles, statuses, or workflows as approved features.
- Must not hide business behavior inside generic CRUD operations.
- Serves a single insurance agency in the first release.
- Does not provide tenant isolation, organization switching, subscription
  management, or multi-tenant user interfaces in the first release.

## Expected Outcomes

The product succeeds when:

- Admins can understand workload and assign responsibility clearly.
- Agents can see context, priorities, and next actions without reconstructing
  history from separate tools.
- Leads progress according to documented rules.
- Customer and Policy history remains available across renewals and support.
- Important business events and system changes are traceable.
- New features can be added without weakening established business rules.

Numeric success targets must be defined separately once baseline business data
and product priorities are known.

## Direction for Codex

Before implementing a feature, Codex must:

1. Read the relevant product, requirement, workflow, system, and API documents.
2. Identify the actors, trigger, business rules, state changes, and side
   effects.
3. Ask for clarification when required behavior is undocumented.
4. Implement only the approved scope and avoid unrelated changes.
5. Add appropriate tests and update documentation when business behavior
   changes.

## Deployment and Scalability Direction

The first release serves one insurance agency and is not a multi-agency SaaS
product.

Future multi-agency support is a planned evolution, not current scope. To avoid
a major rewrite later:

- Keep authentication, authorization, and business modules loosely coupled.
- Keep business logic modular and independent of deployment assumptions.
- Avoid scattering agency-specific names, settings, or behavior throughout the
  codebase.
- Define clear boundaries where an **Organization** entity and organization
  ownership could be introduced later.

Do not add an Organization entity, tenant identifiers, data isolation,
organization switching, subscription management, or other multi-tenant
behavior unless a future approved requirement introduces them.
