# ADR-DX-001: Unified Public Facade vs. Internal Modularity

- **Status:** Accepted
- **Date:** 2026-09-28
- **Context:** Phase 19 Developer Experience Overhaul

---

## 1. Context

JSango was built from the ground up as a highly modular monorepo containing over 30 isolated packages (`@jsango/core`, `@jsango/http`, `@jsango/router`, `@jsango/orm`, `@jsango/validation`, `@jsango/websocket`, `@jsango/admin`, etc.).

While this architecture guarantees strict dependency inversion, testability, and runtime independence, it placed a heavy cognitive burden on everyday application developers:
1. Developers had to manually install 5-10 individual `@jsango/*` packages.
2. Applications required verbose, repetitive bootstrapping code (creating DI containers, HTTP server adapters, middleware pipelines, and manually wiring routers).
3. Developers had to remember which specific package exported which class or type.

---

## 2. Decision

We separate **internal architecture** from **public developer experience**:
1. **Preserve Internal Modularity:** All internal packages remain standalone, decoupled, strictly typed, and published. Framework contributors, plugin authors, and enterprise customizations can continue importing individual `@jsango/*` packages directly.
2. **Unified Developer Entry Point:** The root `jsango` package acts as a high-level facade exposing:
   - `createApp()` with automatic middleware chaining, variadic route middleware, auto-serialization, and built-in Admin/OpenAPI/CRUD helpers.
   - Built-in schema validation builders (`string()`, `number()`, `boolean()`, `email()`, `validate()`).
   - Simplified ORM model definition (`model()`) and static query delegation (`User.where()`, `User.find()`, `User.all()`).
   - Idiomatic WebSocket endpoints (`app.ws('/path', (socket) => ...)`).
   - Singleton facades for `events`, `jobs`, `cache`, and `response`.
3. **Single Installation:** Applications install `jsango` as their primary dependency: `npm install jsango`.

---

## 3. Consequences

### Positive
- **Drastic Boilerplate Reduction:** Common CRUD, WebSocket, and API routes require up to 60-90% less code.
- **Zero Loss of Power:** Advanced users can immediately drop down to underlying router, container, or query AST abstractions.
- **Faster Onboarding:** Beginners can build production-ready APIs in under 5 minutes without learning internal architectural subsystems.
- **Unified TypeScript Autocomplete:** All core utilities and builders are discovered through a single import statement.

### Negative / Trade-offs
- The `jsango` facade package has dependencies on core JSango packages.
- Additions to internal packages must be intentionally re-exported and mapped in the root facade.

---

## 4. Alternatives Considered

1. **Delete modular packages and collapse into a monolithic package:**
   - *Rejected:* Would destroy clean architectural boundaries, make testing individual subsystems difficult, and prevent modular adoption.
2. **Keep multi-package imports and rely solely on documentation:**
   - *Rejected:* Creates excessive friction, high barrier to entry, and poor developer sentiment compared to modern fullstack frameworks.
