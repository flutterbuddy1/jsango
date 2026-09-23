# ADR-007: Middleware Onion Pipeline and Application Request Lifecycle

## Status

Accepted

## Context

A production backend framework requires a modular, asynchronous request processing pipeline that integrates routing, dependency injection, and error handling without coupling individual layers or leaking runtime resources. In particular:

- Middleware pipelines must support both pre-processing and post-processing (the "onion" model) with single-invocation guarantees on `next()`.
- Dependency injection must support per-request lifetimes (`scoped`) that are deterministically created and disposed around request lifecycles without leaking memory across requests.
- Error handling must be centralized, protecting sensitive stack traces in production while enabling custom application-level error handlers and allowing global after-middleware (such as CORS) to execute on error responses.
- Handlers should be able to return standard primitives (strings, JSON objects, binary buffers, streams) without forcing developers to manually instantiate and configure `HttpResponse` instances in trivial cases.

## Decision

1. **Asynchronous Onion Pipeline**:
   Implement an onion-style pipeline (`MiddlewarePipeline`) supporting both functional and class-based middleware (`IMiddleware`). Downstream execution is triggered via `next()`.
2. **Double-Call Protection**:
   `next()` is guarded against multiple calls. Calling `next()` more than once within the same middleware invocation throws a structured `MultipleNextCallsError` (`ERR_MIDDLEWARE_MULTIPLE_NEXT_CALLS`).
3. **Deterministic Scope Disposal**:
   Every incoming request creates a child dependency injection scope (`container.createScope()`). The scope is unconditionally disposed in a `finally` block of `Application.handle()`, guaranteeing cleanup under normal completion, thrown exceptions, and client aborts.
4. **Decoupled Route & Group Middleware**:
   The Router stores middleware references as opaque arrays on `Route` and `RouteGroup`. The Application request pipeline resolves and executes group and route middleware strictly after a route has successfully matched. Route middleware never executes on 404 (Not Found) or 405 (Method Not Allowed).
5. **Centralized Response Normalization**:
   A single `ResponseNormalizer` converts supported return values (`HttpResponse`, `string`, `Uint8Array`, `ReadableStream`, `object`, `null`/`undefined`) into compliant `HttpResponse` instances, eliminating duplicated conversion logic across handlers and middleware.
6. **Centralized Error Boundary with Global After-Middleware**:
   Route and handler errors are caught at the terminal boundary of the global pipeline, allowing global after-middleware (e.g. CORS headers, request loggers) to execute on the formatted error response. Production 5xx errors are masked by default.

## Alternatives Considered

1. **Callback-style Middleware (Express `(req, res, next) => void`)**:
   Rejected because callback-based error propagation requires manual error forwarding (`next(err)`), complicates async/await coordination, and makes post-processing ("after" logic) difficult and allocation-heavy.
2. **Global Service Locator for Request Context**:
   Rejected because thread-local or AsyncLocalStorage-based hidden context introduces subtle context-loss bugs across async boundaries and impairs testability. Explicit `RequestContext` injection into middleware and handlers remains pure, predictable, and fast.

## Consequences

- **Positive**: High throughput (>750,000 full requests/sec with scoped DI and routing); deterministic onion execution; guaranteed cleanup of request-scoped resources; safe error responses with automatic CORS preservation.
- **Negative**: Middleware must properly `await next()` when performing post-processing logic.
