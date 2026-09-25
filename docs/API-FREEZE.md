# django-js 1.0.0 Public API Freeze

**Effective Date**: 2026-09-25  
**Milestone**: `django-js v1.0.0 Stable Release`  
**Status**: **FROZEN**

---

## 1. Scope of the API Freeze

As of version `1.0.0`, all public API signatures, exported types, function parameters, class interfaces, and error codes across the 25 framework packages are formally **FROZEN**.

No breaking modifications, signature alterations, or removal of public symbols are permitted within the `1.x.x` release series.

---

## 2. Frozen Package Inventory

The following 25 packages are frozen under Tier 1 Stable Public API guarantees:

1. `@django-js/runtime`
2. `@django-js/core`
3. `@django-js/container`
4. `@django-js/config`
5. `@django-js/http`
6. `@django-js/router`
7. `@django-js/middleware`
8. `@django-js/database`
9. `@django-js/orm`
10. `@django-js/migrations`
11. `@django-js/validation`
12. `@django-js/cli`
13. `@django-js/auth`
14. `@django-js/cache`
15. `@django-js/queue`
16. `@django-js/events`
17. `@django-js/websocket`
18. `@django-js/admin-core`
19. `@django-js/admin-server`
20. `@django-js/admin-auth`
21. `@django-js/admin-audit`
22. `@django-js/admin-media`
23. `@django-js/openapi`
24. `@django-js/observability`
25. `@django-js/testing`

---

## 3. Post-Freeze Engineering Policy

Any subsequent evolution of the framework must adhere to:

1. **Additive Changes Only**: New capabilities must be introduced via new methods, optional parameters, or additive interfaces.
2. **Strict Deprecation Workflow**: Any feature considered for replacement must follow the deprecation process outlined in [API-STABILITY.md](API-STABILITY.md).
3. **Evidence-Driven Optimizations**: Performance improvements must maintain 100% semantic and behavioral compatibility.
