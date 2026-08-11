# Recommended Folder Structure

## 1. Purpose

This is the required dependency shape for a future implementation, not a
framework selection. Adapt framework-specific filenames while preserving the
module and layer boundaries.

```text
src/
  app/
    bootstrap/
    config/
    http/
      middleware/
      routes/
  modules/
    identity/
      domain/
      application/
      infrastructure/
      interface/
    leads/
      domain/
      application/
        commands/
        queries/
      infrastructure/
      interface/
    follow-ups/
      domain/
      application/
      infrastructure/
      interface/
    notes/
    history/
    notifications/
    reporting/
  shared/
    domain/
    application/
    infrastructure/
tests/
  unit/
  integration/
  smoke/
docs/
```

## 2. Dependency Rules

- `domain` imports only its own domain code and minimal shared domain types.
- `application` imports domain code and declares ports.
- `infrastructure` implements ports and may import technology libraries.
- `interface` maps transport input/output and invokes application use cases.
- One module cannot import another module's infrastructure or mutate its
  persistence model.
- Shared code must be business-neutral and proven reusable; it is not a dumping
  ground for cross-module behavior.

## 3. Naming

Use business-action names such as `assign-lead`, `complete-follow-up`, and
`reopen-lead`. Avoid generic services such as `CommonService` or
`BaseBusinessManager`. Tests mirror source modules and name the behavior under
test.

## 4. Configuration and Generated Output

Configuration is validated during startup. Secrets never enter source control.
Build output, coverage, logs, uploaded files, and local databases remain
outside `src/` and are ignored by version control.
