# jsango 1.0.0 Public API Freeze

**Effective Date**: 2026-09-25  
**Milestone**: `jsango v1.0.0 Stable Release`  
**Status**: **FROZEN**

---

## 1. Scope of the API Freeze

As of version `1.0.0`, all public API signatures, exported types, function parameters, class interfaces, and error codes across the 25 framework packages are formally **FROZEN**.

No breaking modifications, signature alterations, or removal of public symbols are permitted within the `1.x.x` release series.

---

## 2. Frozen Package Inventory

The following 25 packages are frozen under Tier 1 Stable Public API guarantees:

1. `@jsango/runtime`
2. `@jsango/core`
3. `@jsango/container`
4. `@jsango/config`
5. `@jsango/http`
6. `@jsango/router`
7. `@jsango/middleware`
8. `@jsango/database`
9. `@jsango/orm`
10. `@jsango/migrations`
11. `@jsango/validation`
12. `@jsango/cli`
13. `@jsango/auth`
14. `@jsango/cache`
15. `@jsango/queue`
16. `@jsango/events`
17. `@jsango/websocket`
18. `@jsango/admin-core`
19. `@jsango/admin-server`
20. `@jsango/admin-auth`
21. `@jsango/admin-audit`
22. `@jsango/admin-media`
23. `@jsango/openapi`
24. `@jsango/observability`
25. `@jsango/testing`

---

## 3. Post-Freeze Engineering Policy

Any subsequent evolution of the framework must adhere to:

1. **Additive Changes Only**: New capabilities must be introduced via new methods, optional parameters, or additive interfaces.
2. **Strict Deprecation Workflow**: Any feature considered for replacement must follow the deprecation process outlined in [API-STABILITY.md](API-STABILITY.md).
3. **Evidence-Driven Optimizations**: Performance improvements must maintain 100% semantic and behavioral compatibility.
