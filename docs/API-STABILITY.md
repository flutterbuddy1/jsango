# jsango Public API Stability Policy

This document defines the formal stability classification, deprecation policies, and Semantic Versioning guarantees for all public APIs across the `jsango` ecosystem beginning with **v1.0.0**.

---

## 1. API Stability Tiers

Every symbol exported by a `@jsango/*` package belongs to one of four formal tiers:

### Tier 1: Stable Public API

- **Definition**: All classes, interfaces, types, functions, and factories exported from package root entry points (`packages/*/src/index.ts` / `./dist/index.d.ts`).
- **Guarantees**: Guaranteed backwards-compatible within the same major version (`1.x.x`). Breaking signature or semantic changes will NEVER occur without a major version bump (`2.0.0`).
- **Examples**: `Application`, `HttpRequest`, `HttpResponse`, `Router`, `Container`, `DatabaseManager`, `defineModel`, `fields`, `relations`, `ScryptPasswordHasher`, `UserIdentity`, `BasePolicy`, `PolicyRegistry`, `CacheManager`, `QueueManager`, `EventBus`, `RoomManager`, `AdminResource`, `OpenApiGenerator`, `StructuredLogger`, `MetricRegistry`, `Tracer`, `HealthRegistry`.

### Tier 2: Experimental API

- **Definition**: APIs explicitly annotated with `@experimental` in JSDoc or exported from experimental subpaths.
- **Guarantees**: May undergo adjustments in minor releases based on community feedback.
- **Current Status**: All core 25 packages in 1.0.0 are stable Tier 1.

### Tier 3: Internal Implementation API

- **Definition**: Code located in `src/internal/*` or unexported files.
- **Guarantees**: Private to the framework. Not covered by SemVer guarantees. Consumers must not rely on internal file paths.

### Tier 4: Deprecated API

- **Definition**: APIs scheduled for future removal, annotated with `@deprecated` in JSDoc.
- **Policy**: Deprecated APIs remain fully functional throughout the current major version (`1.x.x`) and are only removed in the next major version (`2.0.0`).

---

## 2. Semantic Versioning Rules (Post-1.0)

`jsango` follows [SemVer 2.0.0](https://semver.org/):

- **MAJOR (`X.0.0`)**: Incompatible public API changes, removed deprecated APIs, or bumped minimum Node.js runtime requirement.
- **MINOR (`1.X.0`)**: Backwards-compatible new features, additive packages, or new adapters.
- **PATCH (`1.0.X`)**: Backwards-compatible bug fixes, security patches, and internal performance optimizations.
