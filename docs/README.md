# Insurance CRM Documentation Map

## Release 1: Lead Management

Read documents in this order:

1. `master.md` — documentation philosophy and long-term context
2. `00-product/vision.md` and `00-product/glossary.md` — scope and language
3. `01-requirements/business-requirements.md` — approved capabilities
4. `01-requirements/user-stories.md` and `acceptance-criteria.md`
5. `06-workflows/lead-flow.md` — authoritative Lead state machine
6. `02-system/architecture.md`, `auth.md`, and `api-standards.md`
7. `03-database/*` and `05-api/lead.md`
8. `04-design/*` and `07-testing/*`
9. `decisions/*` — accepted architectural/business-boundary decisions

Frontend integration for the complete Client creation endpoint is documented
in `05-api/client-create.md`. Client list integration is documented in
`05-api/client-list.md`, and complete Client detail integration is documented
in `05-api/client-detail.md`. Client information updates are documented in
`05-api/client-update.md`, and Client Company updates are documented in
`05-api/client-company-update.md`. Client Member, Vehicle, and Driver creation,
updates, and deletion are documented in
`05-api/client-related-record-update.md`.
Client Service creation, updates, and deletion are documented in
`05-api/client-service-crud.md`.
Client Document upload and Cloudinary-backed deletion are documented in
`05-api/client-document-crud.md`.
Client dashboard renewal and inventory KPIs are documented in
`05-api/client-dashboard-kpi.md`.
The paginated Client Company list is documented in
`05-api/client-company-list.md`.
Profit and Loss Expense creation is documented in
`05-api/profit-loss-expense.md`.
Monthly Profit and Loss reporting is documented in
`05-api/profit-loss-report.md`.

## Document Status

| Area | Release 1 status |
| --- | --- |
| Product vision and glossary | Defined |
| Lead business requirements, stories, and acceptance | Defined |
| Lead and Follow-up workflows | Defined |
| Architecture, authorization, API standards, and coding rules | Defined |
| Logical data model, relationships, and indexes | Defined |
| Lead/User API contracts | Defined |
| Lead UI system and test strategy | Defined |
| Quotation, Policy, Renewal, Customer conversion, Claim, Documents | Deferred |

“Deferred” means the boundary is documented but behavior is intentionally not
invented. A deferred file is not implementation authorization.

## Change Rule

A behavior change must update the highest-level source of truth first, then all
affected workflow, API, data, UI, test, and ADR documents in the same change.
An implementation must not resolve an explicit pending product decision by
assumption.
