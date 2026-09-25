# jsango 1.0.0 Migration & Upgrade Guide

This guide assists developers in upgrading existing projects to the **1.0.0 Stable Release** of `jsango`.

---

## 1. Upgrading Dependencies

Update all `@jsango/*` packages in `package.json` to `^1.0.0`:

```json
{
  "dependencies": {
    "@jsango/core": "^1.0.0",
    "@jsango/http": "^1.0.0",
    "@jsango/router": "^1.0.0",
    "@jsango/middleware": "^1.0.0",
    "@jsango/database": "^1.0.0",
    "@jsango/orm": "^1.0.0",
    "@jsango/migrations": "^1.0.0",
    "@jsango/validation": "^1.0.0",
    "@jsango/cli": "^1.0.0",
    "@jsango/auth": "^1.0.0",
    "@jsango/cache": "^1.0.0",
    "@jsango/queue": "^1.0.0",
    "@jsango/events": "^1.0.0",
    "@jsango/websocket": "^1.0.0",
    "@jsango/admin-core": "^1.0.0",
    "@jsango/admin-server": "^1.0.0",
    "@jsango/openapi": "^1.0.0",
    "@jsango/observability": "^1.0.0"
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
4. **Structured Error Hierarchy**: All custom framework errors extend `JsangoError` with safe machine-readable error codes.
