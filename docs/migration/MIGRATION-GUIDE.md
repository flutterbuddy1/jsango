# django-js Framework Migration & Upgrade Guide

This guide describes versioning conventions, upgrade procedures, and API stability expectations for applications built on `django-js`.

---

## Semantic Versioning Policy

`django-js` adheres strictly to [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR (`X.0.0`)**: Incompatible public API changes, architectural rewrites, or minimum Node.js runtime version bumps.
- **MINOR (`0.X.0` or `X.Y.0`)**: Backwards-compatible new features, new packages, and additive abstractions.
- **PATCH (`0.0.X` or `X.Y.Z`)**: Backwards-compatible bug fixes, security patches, and performance optimizations.
- **PRE-RELEASE (`X.Y.Z-rc.N`)**: Release candidates for stabilization, bug fixes, and community validation.

---

## Upgrading to `0.1.0-rc.1`

### 1. Package Synchronization

Ensure all `@django-js/*` packages in your `package.json` are pinned to the same release candidate version:

```json
{
  "dependencies": {
    "@django-js/core": "^0.1.0-rc.1",
    "@django-js/http": "^0.1.0-rc.1",
    "@django-js/router": "^0.1.0-rc.1",
    "@django-js/middleware": "^0.1.0-rc.1",
    "@django-js/database": "^0.1.0-rc.1",
    "@django-js/orm": "^0.1.0-rc.1",
    "@django-js/migrations": "^0.1.0-rc.1",
    "@django-js/auth": "^0.1.0-rc.1",
    "@django-js/cache": "^0.1.0-rc.1",
    "@django-js/queue": "^0.1.0-rc.1",
    "@django-js/events": "^0.1.0-rc.1",
    "@django-js/websocket": "^0.1.0-rc.1",
    "@django-js/admin-core": "^0.1.0-rc.1",
    "@django-js/openapi": "^0.1.0-rc.1",
    "@django-js/observability": "^0.1.0-rc.1"
  }
}
```

### 2. Router Lifecycle

Ensure `router.compile()` or `app.listen()` is awaited during application startup before incoming traffic begins. In `0.1.0-rc.1`, compiled route trees are frozen for thread-safe high-concurrency execution.

### 3. ORM Relationship Loading

Ensure all relation queries use explicit `.with()` declarations:

```typescript
// Correct:
const users = await User.query().with('posts').all();

// Deprecated / Prohibited:
// user.posts (implicit property access query)
```
