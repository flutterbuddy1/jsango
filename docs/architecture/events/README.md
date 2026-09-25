# @jsango/events Architecture Overview

## 1. Core Mission & Philosophy

`@jsango/events` provides a production-grade, typed in-process and background event dispatching system for the JSango (`jsango`) framework. It enables loosely-coupled component communication, telemetry integration, domain event propagation, and background job decoupling.

Key design principles:

- **Strict Type Safety**: Events carry typed payloads and explicit schema versions.
- **Execution Modes**: Handlers declare their execution semantics (`sync`, `async`, `queued`).
- **Priority-Based Dispatch**: Handlers are executed deterministically sorted by priority.
- **Middleware Pipeline**: Dedicated event middleware (onion pattern) separate from HTTP and Queue middleware.
- **Zero Hard Queue Dependency**: Integrates with `@jsango/queue` through the `IEventQueueAdapter` contract without compile-time coupling.
- **Admin & Telemetry Introspection**: `EventRegistry.inspect()` provides structured data for diagnostics and Admin UI.

---

## 2. Architecture Layers

```
Application / Domain Logic
          ↓
       EventBus
    ├── EventMiddlewarePipeline (validation, logging, telemetry)
    ├── EventRegistry (priority-sorted type → handler mapping)
    │        ├── Sync Handlers (sequential, deterministic order)
    │        ├── Async Handlers (concurrent, Promise.allSettled)
    │        └── Queued Handlers
    │                 ↓
    │          IEventQueueAdapter
    │                 ↓
    │           @jsango/queue
    └── EventLifecycleHooks (onDispatched, onHandlerStarted, onHandlerCompleted, onHandlerFailed)
```

---

## 3. Key Components

### 3.1 EventDefinition & createEvent

- Immutable representation of an event with unique `eventId` (UUIDv4), `type`, `payload`, `timestamp`, `schemaVersion`, and optional `metadata`.
- Created via the `createEvent()` factory helper.

### 3.2 EventRegistry

- Manages handler registrations grouped by event type.
- Enforces duplicate prevention for explicit handler IDs.
- Deterministically sorts handlers by priority descending (`priority: number`).
- Filters handlers by mode (`getHandlersByMode(type, mode)`).

### 3.3 EventBus

- Orchestrates event dispatching through:
  1. Middleware pipeline execution.
  2. Sequential execution of `sync` handlers in priority order.
  3. Concurrent execution of `async` handlers via `Promise.allSettled`.
  4. Forwarding `queued` handlers to `IEventQueueAdapter`.
- Provides `on()`, `emit()`, `dispatch()`, `off()`, `use()`, `setQueueAdapter()`, `close()`.

### 3.4 EventSerializer

- Validates and serializes event definitions into JSON strings suitable for transport across queues or websockets.
- Rejects non-serializable objects (functions, symbols, circular references).

### 3.5 QueueEventAdapter

- Implements `IEventQueueAdapter` to serialize events into background job payloads (`event:<type>`) dispatched via `@jsango/queue`.

---

## 4. Execution Semantics

| Mode     | Execution Timing             | Error Handling                                     | Use Case                                   |
| :------- | :--------------------------- | :------------------------------------------------- | :----------------------------------------- |
| `sync`   | Sequential in priority order | Logged; aggregate throw with `throwOnHandlerError` | Transactional side-effects, cache eviction |
| `async`  | Concurrent in-process        | Logged; isolated via Promise.allSettled            | Non-blocking metrics, local notifications  |
| `queued` | Deferred via queue adapter   | Handled by queue worker retry policies             | Emails, webhooks, heavy background jobs    |

---

## 5. Testing Utilities

- `FakeEventBus` records all dispatched and emitted events for assertion in unit/integration tests without executing real handlers or background queues.
