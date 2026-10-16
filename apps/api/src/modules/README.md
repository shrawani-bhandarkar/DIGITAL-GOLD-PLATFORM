# API domain modules

Each domain owns its routes, request/response schemas, controller or handler, service, and repository boundary. Keep HTTP handling thin; put business rules in services. Require authentication and permission checks on all non-health routes.

Suggested module layout when implementation begins:

```text
<domain>/
  routes.ts
  schemas.ts
  controller.ts
  service.ts
  repository.ts
  types.ts
```

Domain folders below document scope only; they do not contain implemented business logic.

