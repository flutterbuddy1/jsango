# django-js 1.0.0 Migration & Upgrade Guide

This guide assists developers in upgrading existing projects to the **1.0.0 Stable Release** of `django-js`.

---

## 1. Upgrading Dependencies

Update all `@django-js/*` packages in `package.json` to `^1.0.0`:

```json
{
  "dependencies": {
    "@django-js/core": "^1.0.0",
    "@django-js/http": "^1.0.0",
    "@django-js/router": "^1.0.0",
    "@django-js/middleware": "^1.0.0",
    "@django-js/database": "^1.0.0",
    "@django-js/orm": "^1.0.0",
    "@django-js/migrations": "^1.0.0",
    "@django-js/validation": "^1.0.0",
    "@django-js/cli": "^1.0.0",
    "@django-js/auth": "^1.0.0",
    "@django-js/cache": "^1.0.0",
    "@django-js/queue": "^1.0.0",
    "@django-js/events": "^1.0.0",
    "@django-js/websocket": "^1.0.0",
    "@django-js/admin-core": "^1.0.0",
    "@django-js/admin-server": "^1.0.0",
    "@django-js/openapi": "^1.0.0",
    "@django-js/observability": "^1.0.0"
  }
}
```

Then run:

```bash
pnpm update
```

---

## 2. Key Architectural Invariants in 1.0.0

1. **Router Immutability**: All route registrations must be completed during application startup. Route radix trees are compiled and frozen upon server listen.
2. **Explicit ORM Eager Loading**: Implicit lazy loading on property access is prohibited. Always declare relation queries with `.with('relationName')`.
3. **Fail-Closed Security**: Missing authentication credentials or unmapped policy actions strictly evaluate to `401 Unauthorized` / `403 Forbidden`.
4. **Structured Error Hierarchy**: All custom framework errors extend `DjangoJsError` with safe machine-readable error codes.
