# ADR-024: Event Bus Architecture & Delivery Semantics

## Context

Complex applications require decoupling between core business operations (e.g. user registration, billing transactions) and secondary side-effects (e.g. welcome notifications, audit logging, telemetry, webhooks). The framework requires a typed, flexible event dispatching mechanism that allows synchronous, asynchronous, and background (queued) execution without tight coupling.

## Decision

1. **Typed Event Definition**:
   - Every event is represented as an immutable `EventDefinition<Payload>` with a unique UUID `eventId`, `type`, `schemaVersion`, `timestamp`, and `payload`.
   - Event creation is standardized through the `createEvent()` factory function.
2. **Tri-Mode Execution Model**:
   - `sync`: Sequential execution in priority order within the current tick; blocks `dispatch()` until completed.
   - `async`: Concurrent non-blocking execution in-process via `Promise.allSettled`.
   - `queued`: Delegated to the background queue system via `IEventQueueAdapter` for durable, asynchronous background execution.
3. **Priority Ordering**:
   - Handlers are registered with an optional `priority: number` (higher values run earlier).
   - Sync handlers execute deterministically in priority order, then registration order.
4. **Dedicated Event Middleware**:
   - Event middleware operates via an onion pipeline (`EventMiddlewarePipeline`) independent of HTTP and Queue middleware.
   - Enables centralized event logging, schema validation, authorization, and telemetry.
5. **Decoupled Queue Integration**:
   - `EventBus` has zero compile-time dependency on `@jsango/queue`.
   - Communication with the queue system occurs through the `IEventQueueAdapter` abstraction (`QueueEventAdapter`).

## Consequences

- Domain logic can emit events cleanly without worrying about whether side-effects are processed immediately or in the background.
- Testability is enhanced via `FakeEventBus`.
- Serialization guarantees that queued events do not hold circular references or invalid symbols.
