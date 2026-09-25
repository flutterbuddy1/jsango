# ADR-023: Queue & Background Job Architecture

## Context

Production applications need deferred execution for tasks like email sending, report generation, webhook delivery, and data processing. The framework requires a background job system that supports retries, delays, scheduled execution, concurrent workers, and graceful shutdown — without mandating external infrastructure like Redis or RabbitMQ.

## Decision

1. **Driver-Based Architecture**:
   - All queue backends implement the `IQueueDriver` contract with explicit `QueueCapabilities`.
   - `QueueManager` orchestrates named queue connections, worker lifecycle, and driver factories.
   - Built-in drivers: `MemoryQueueDriver` (development/testing) and `DatabaseQueueDriver` (production via `@django-js/database`).
2. **AT-LEAST-ONCE Delivery**:
   - Jobs are guaranteed to execute at least once. Handlers must be idempotent.
   - Visibility leases (`locked_until`) prevent duplicate processing in multi-worker environments.
   - Failed jobs are retried with configurable retry policies before being routed to dead-letter storage.
3. **Retry Policies**:
   - `RetryCalculator` supports `fixed` and `exponential` backoff with configurable `maxDelayMs` cap.
   - Optional jitter (±25%) prevents retry storms from synchronized workers.
   - Jobs exceeding `maxAttempts` are routed to `IFailedJobStore`.
4. **Worker Architecture**:
   - `Worker` is a long-running polling process with configurable concurrency, polling interval, and idle backoff.
   - Job timeout enforcement via `AbortSignal` and `AbortController`.
   - Graceful shutdown: `stop()` sets shutdown signal, in-flight jobs complete within `shutdownTimeoutMs`.
   - `--once` mode for single-pass execution (CI pipelines, testing).
5. **Queue Middleware (Separate from HTTP)**:
   - Queue middleware follows the onion pattern but is scoped exclusively to job execution.
   - Middleware pipeline wraps job handlers for logging, metrics, tracing, and error enrichment.
   - Queue middleware is NOT the same as HTTP middleware and cannot be used interchangeably.
6. **Job Serialization**:
   - Job payloads are strictly JSON-serializable.
   - Functions, closures, and symbols are explicitly rejected during serialization.

## Consequences

- Applications can process background work without external infrastructure dependencies.
- The `DatabaseQueueDriver` provides persistent, production-ready job storage using existing database connections.
- Worker concurrency and retry policies are independently configurable per queue.
- Graceful shutdown integrates cleanly with the existing application lifecycle.
