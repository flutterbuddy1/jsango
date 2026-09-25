# jsango Framework Migration & Upgrade Guide

This guide describes versioning conventions, upgrade procedures, and API stability expectations for applications built on `jsango`.

---

## Semantic Versioning Policy

`jsango` adheres strictly to [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR (`X.0.0`)**: Incompatible public API changes, architectural rewrites, or minimum Node.js runtime version bumps.
- **MINOR (`0.X.0` or `X.Y.0`)**: Backwards-compatible new features, new packages, and additive abstractions.
- **PATCH (`0.0.X` or `X.Y.Z`)**: Backwards-compatible bug fixes, security patches, and performance optimizations.
- **PRE-RELEASE (`X.Y.Z-rc.N`)**: Release candidates for stabilization, bug fixes, and community validation.

---

## Upgrading to `0.1.0-rc.1`

### 1. Package Synchronization

Ensure all `@jsango/*` packages in your `package.json` are pinned to the same release candidate version:

```json
{
  "dependencies": {
    "@jsango/core": "^0.1.0-rc.1",
    "@jsango/http": "^0.1.0-rc.1",
    "@jsango/router": "^0.1.0-rc.1",
    "@jsango/middleware": "^0.1.0-rc.1",
    "@jsango/database": "^0.1.0-rc.1",
    "@jsango/orm": "^0.1.0-rc.1",
    "@jsango/migrations": "^0.1.0-rc.1",
    "@jsango/auth": "^0.1.0-rc.1",
    "@jsango/cache": "^0.1.0-rc.1",
    "@jsango/queue": "^0.1.0-rc.1",
    "@jsango/events": "^0.1.0-rc.1",
    "@jsango/websocket": "^0.1.0-rc.1",
    "@jsango/admin-core": "^0.1.0-rc.1",
    "@jsango/openapi": "^0.1.0-rc.1",
    "@jsango/observability": "^0.1.0-rc.1"
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
