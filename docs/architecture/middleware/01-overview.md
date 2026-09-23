# Middleware & Application Request Lifecycle Overview

## Identity and Responsibilities

`@django-js/middleware` provides the core application request pipeline and middleware engine of Nexora. It integrates the foundational layers (`Runtime`, `Core`, `Container`, `Config`, `HTTP`, and `Router`) into an asynchronous, onion-style request lifecycle.

## Architectural Layers Integrated

```
Incoming Request (HTTP / Fetch / Socket)
   ↓
Runtime HTTP Server Adapter (NodeHttpServer)
   ↓
RequestContext Creation (request, response, signal, logger, state)
   ↓
Request-Scoped Container (isolated scope created)
   ↓
Global Middleware Pipeline (Onion Before)
   ↓
Route Dispatcher (Router matching)
   ├── Matched:
   │     ├── Populate ctx.request.params & ctx.state.set('route', match.route)
   │     ├── Resolve Route & Group Middleware
   │     └── Execute Route Pipeline → Handler
   ├── 405 Method Not Allowed (returns 405 + Allow header, no route middleware)
   └── 404 Not Found (returns 404, no route middleware)
   ↓
Response Normalization (HttpResponse, string, JSON, bytes, streams, 204)
   ↓
Global Middleware Pipeline (Onion After)
   ↓
HTTP Response Sent to Client
   ↓
Request Scope Cleanup (finally: scope.dispose())
```

## Key Capabilities

1. **Onion-Style Middleware Execution**:
   Deterministic before/after execution with `next()` invocation.
2. **Double-Call Prevention**:
   Strict enforcement that `next()` may only be called once per middleware invocation. Violations immediately throw `MultipleNextCallsError`.
3. **Short-Circuiting**:
   Any middleware can return early without calling `next()`, bypassing all downstream middleware and handlers while executing upstream after-logic.
4. **Centralized Response Normalization**:
   Handlers and middleware can return plain strings, JSON objects, byte arrays, streams, or `void`, which are automatically normalized into compliant `HttpResponse` objects.
5. **Request-Scoped Container Isolation**:
   Every incoming request receives an isolated DI scope (`createScope()`) that is deterministically disposed in a `finally` block, preventing memory and connection leaks.
6. **Centralized Error Boundary**:
   Catches downstream exceptions, executes custom error handlers when registered, and safely serializes production errors without leaking internal stack traces or database connection details.
7. **Strict Separation of 404 and 405**:
   Global middleware executes for all requests (ensuring CORS, logging, and security headers are attached to error responses), while route-level middleware executes strictly on matched routes.
