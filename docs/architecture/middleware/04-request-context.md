# RequestContext & Scoped Services

## Structure

Every incoming request is encapsulated within an isolated `RequestContext`:

- `request`: The incoming `HttpRequest`.
- `response`: The mutable `HttpResponse` configured during request processing.
- `requestId`: Unique correlation identifier.
- `logger`: Contextual logger instance tagged with the `requestId`.
- `signal`: `AbortSignal` for tracking request cancellation.
- `state`: Scoped key-value map (`Map<string, unknown>`) for passing arbitrary per-request state between middlewares and handlers.
- `container`: Dedicated request-scoped dependency injection container (`Container`).

## Request-Scoped Dependency Injection

1. **Scope Creation**:
   Upon receiving a request, `Application.handle(req)` creates a child container scope via `rootContainer.createScope()`.
2. **Resolution**:
   Services registered with `scoped` lifetime are instantiated once and cached within that request's container scope.
3. **Disposal Guarantee**:
   The request scope is unconditionally disposed in a `finally` block at the conclusion of `Application.handle`. All registered `onDispose` hooks and `dispose()` methods on scoped instances are executed, ensuring zero memory or connection leakage even under unhandled exceptions or client disconnects.
