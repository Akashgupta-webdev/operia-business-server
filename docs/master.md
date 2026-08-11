# Insurance CRM Documentation Context

## Project Overview

This project is an Insurance CRM (Customer Relationship Management) platform designed for insurance agencies and brokers to manage the complete customer lifecycle, from lead generation to policy renewal and claim support.

The objective is **not simply to build CRUD operations**, but to design a scalable business management platform that models real insurance business processes.

The documentation produced for this project will become the primary source of truth for both developers and AI coding assistants (Codex). Every future implementation should reference these documents before generating code.

The documentation should be written with long-term maintainability in mind, allowing new developers or AI agents to understand the system without requiring previous chat history.

---

# Development Philosophy

This project follows these principles:

* Business-first design
* Workflow-driven architecture
* Documentation before implementation
* Scalable modular architecture
* Business rules explicitly documented
* Consistent coding standards
* AI-assisted development with deterministic context
* Minimal ambiguity

The implementation should always be driven by documented business requirements instead of assumptions.

---

# Documentation Goals

The documentation should:

* Explain the insurance business.
* Explain why each feature exists.
* Describe workflows instead of pages.
* Describe business rules before technical implementation.
* Separate business requirements from implementation details.
* Be easy for both humans and AI to understand.
* Remain maintainable for years.

Avoid documenting implementation decisions inside business documents.

---

# Target Users

Initially the system supports only two user roles:

* Admin
* Agent

Future expansion may include:

* Branch Manager
* Sales Manager
* Telecaller
* Accountant
* Super Admin

Current documentation should only model Admin and Agent while remaining extensible.

---

# Project Scope

The CRM should eventually manage:

* Lead Management
* Customer Management
* Follow-ups
* Lead Assignment
* Quotations
* Insurance Policies
* Renewals
* Claims
* Customer Documents
* Notes
* Notifications
* Reports
* Dashboard Analytics
* User Management
* Audit Logs

The initial version should focus on establishing a strong architecture rather than implementing every feature.

---

# Business Philosophy

The software models business workflows instead of database tables.

For example:

Do not think:

Lead Page

Instead think:

How does a lead move through the business?

Every module should answer:

* Why does this exist?
* Who uses it?
* What business problem does it solve?
* What triggers it?
* What happens next?

---

# Lead Lifecycle

A lead is NOT a customer.

A lead represents a potential customer.

Typical business lifecycle:

Lead Generated

↓

Lead Assigned

↓

First Contact

↓

Requirement Gathering

↓

Follow-up

↓

Quotation Preparation

↓

Quotation Sent

↓

Negotiation

↓

Payment

↓

Policy Issued

↓

Renewal Reminder

↓

Renewal

↓

Claim Support

↓

Closed

The documentation should explain every stage in detail.

---

# Lead Statuses

The project should define a proper state machine instead of simplistic statuses.

Suggested statuses:

* NEW
* ASSIGNED
* CONTACTED
* FOLLOW_UP
* DOCUMENT_PENDING
* QUOTATION_PREPARING
* QUOTATION_SENT
* NEGOTIATION
* PAYMENT_PENDING
* POLICY_ISSUED
* RENEWAL_DUE
* CLAIM_SUPPORT
* WON
* LOST
* CANCELLED

Each status should define:

* Purpose
* Allowed previous states
* Allowed next states
* Business rules
* Responsible role

---

# Business Objects

The system revolves around these entities:

* Lead
* Customer
* Follow-up
* Activity
* Note
* Quotation
* Policy
* Renewal
* Claim
* Insurance Company
* Insurance Plan
* User
* Agent
* Admin
* Task
* Notification
* Document
* Audit Log

The documentation should explain each entity before designing database schemas.

---

# Follow-up Philosophy

A follow-up is not just a reminder date.

A follow-up is a business activity.

Every follow-up should contain:

* Scheduled date
* Communication method
* Discussion summary
* Outcome
* Next action
* Next follow-up (optional)

Follow-ups should build customer history.

---

# Timeline Philosophy

Every lead should have a complete business timeline.

Examples:

* Lead created
* Assigned to agent
* First contact
* Documents received
* Quotation generated
* Payment received
* Policy issued
* Renewal completed

Timeline represents business events.

---

# Activity Log Philosophy

Activity logs are different from business timelines.

Timeline records business progress.

Activity logs record system actions.

Examples:

* User login
* Status updated
* Phone edited
* Policy downloaded
* Quotation regenerated
* Document deleted

---

# Documentation Structure

Create documentation under a docs directory.

Suggested structure:

docs/

00-business/

01-requirements/

02-system/

03-database/

04-design/

05-api/

06-workflows/

07-testing/

08-security/

09-deployment/

decisions/

Each directory should focus on one responsibility.

---

# Business Requirements

Business requirements should describe what the system must accomplish.

Examples:

* Admin can assign leads.
* Agent can schedule unlimited follow-ups.
* System maintains complete lead history.
* System stores customer documents.
* System generates renewal reminders.
* System tracks policy lifecycle.

Do not include implementation details.

---

# User Stories

Use standard user story format.

Example:

As an Agent,

I want to schedule follow-ups,

so I never miss contacting customers.

Every user story should include business value.

---

# Acceptance Criteria

Acceptance criteria should use Given / When / Then format.

Example:

Given a lead exists,

When an Admin assigns it,

Then ownership changes,

And timeline is updated,

And notification is created.

Every important feature should include acceptance criteria.

---

# Database Documentation

Database documentation should not immediately define schemas.

Instead document:

* Business entities
* Relationships
* Ownership
* Lifecycle
* Constraints
* Validation
* Index requirements

Only then design collections.

---

# API Documentation

API documentation should focus on business actions rather than CRUD.

Examples:

Assign Lead

Schedule Follow-up

Generate Quotation

Upload Documents

Convert Lead

Mark Lost

Transfer Lead

Renew Policy

Each API should define:

* Purpose
* Endpoint
* Authentication
* Authorization
* Request
* Validation
* Response
* Errors
* Business Rules

---

# Frontend Documentation

Frontend documentation should explain workflows instead of pages.

Example:

Lead Detail

Contains:

* Customer Summary
* Current Status
* Timeline
* Follow-ups
* Documents
* Quotations
* Notes
* Activities

Every screen should support the user's workflow.

---

# Coding Philosophy

Although documentation is business-focused, implementation should eventually follow:

* Clean Architecture principles where practical
* Modular feature-based organization
* Repository/service separation
* Consistent API responses
* Validation-first development
* Strong error handling
* Comprehensive logging
* Unit tests
* Integration tests
* Smoke tests
* CI/CD pipeline

---

# AI Development Workflow

Every implementation task should follow this order:

1. Read relevant documentation.
2. Understand business rules.
3. Identify impacted modules.
4. Implement minimal required changes.
5. Add tests.
6. Update documentation if business logic changes.
7. Provide implementation summary.

AI should avoid modifying unrelated files.

---

# Expected Quality

The generated documentation should resemble documentation produced by an experienced software architect rather than simple notes.

Each document should:

* Have clear headings.
* Explain concepts.
* Include diagrams using Markdown.
* Include examples.
* Include future scalability considerations.
* Be implementation-independent whenever possible.
* Remain concise but comprehensive.

The documentation will serve as the permanent context for future AI-assisted development and should be treated as the project's single source of truth.
