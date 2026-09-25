# ADR-005: HTTP Core Abstraction, Runtime Boundary, and Response Lifecycle

## Status

Accepted

## Context

A backend framework must process HTTP requests efficiently while remaining portable across multiple JavaScript runtimes (Node.js and Bun). Tightly coupling request handling to Node.js `IncomingMessage` or `ServerResponse` binds user code and internal routing to Node-specific stream semantics, preventing multi-runtime portability and complicating test doubles. Additionally, undefined response lifecycles often result in subtle bugs where headers are written after responses have already begun flushing.

## Decision

1. **Runtime-Agnostic Abstractions**:
   We define `HttpRequest`, `HttpResponse`, `HttpHeaders`, `Cookies`, `HttpQuery`, and `RequestContext` in `@jsango/http`. These types contain zero Node.js or Bun specific class references.
2. **Adapter Isolation**:
   The `NodeHttpServer` adapter in `src/internal/node/` exclusively interacts with Node's `node:http` module and converts bidirectional data to and from framework abstractions.
3. **Response State Machine**:
   Every response progresses through `created` → `configured` → `committed` → `completed`. Any attempt to mutate headers, cookies, status, or body after the response has transitioned to `committed` immediately throws `ResponseAlreadyCommittedError`.
4. **Security by Default**:
   Headers and cookies enforce strict CRLF injection checks, request bodies enforce a configurable `maxBodySize` (default: 10MB), and production error serialization masks 5xx internal traces.

## Alternatives Considered

1. **Web Standard `Request` and `Response` (Fetch API) as Core**:
   While modern runtimes support `Request`/`Response`, the standard Web Fetch `Response` is immutable upon creation and awkward to configure iteratively through middleware pipelines (e.g. adding headers or cookies across nested handlers requires recreating the `Response` repeatedly). Our `HttpResponse` provides ergonomic, mutable configuration until explicitly committed, optimizing allocation overhead in high-concurrency loops.
2. **Exposing Node `IncomingMessage` Directly**:
   Rejected because it leaks Node.js internals throughout future routing and middleware packages, violating our runtime independence rule.

## Consequences

- **Positive**: Strict runtime independence; zero host leakage into application controllers; high throughput (over 2M JSON responses/sec in microbenchmarks); predictable, safe response lifecycle.
- **Negative**: Requires explicit translation in runtime adapters.
