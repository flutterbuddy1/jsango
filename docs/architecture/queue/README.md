# @django-js/queue Architecture Overview

## 1. Core Mission & Philosophy

`@django-js/queue` provides a production-grade, driver-agnostic background job processing system for the Nexora (`django-js`) framework. It enables deferred execution, retry policies, and concurrent worker processing — all without coupling application logic to a specific queue backend.

Key design principles:

- **Driver Abstraction**: All queue backends implement a single `IQueueDriver` contract.
- **Named Queues**: Multiple named queues can coexist (`default`, `emails`, `reports`), each with independent configurations.
- **Job Registry**: Strongly-typed job definitions registered centrally and resolved at execution time.
- **AT-LEAST-ONCE Delivery**: Jobs are guaranteed to execute at least once; handlers must be idempotent.
- **Visibility Leases**: Workers claim jobs with time-bounded leases to prevent duplicate processing in multi-worker environments.
- **Graceful Shutdown**: Workers honor `AbortSignal` for clean termination of in-flight work.
- **Zero Mandatory External Dependencies**: Ships with `MemoryQueueDriver` and `DatabaseQueueDriver` (using the existing `@django-js/database` layer).

---

## 2. Architecture Layers

```
Application Code
       ↓
QueueManager (orchestrator)
       ↓
Queue (named queue handle, dispatch/delay/schedule)
       ↓
IQueueDriver (raw queue backend)
  ├── MemoryQueueDriver (in-memory, development/testing)
  └── DatabaseQueueDriver (persistent, via @django-js/database)
       ↓
Worker (polling, claim, execute, retry/fail)
       ↓
JobRegistry (type → handler resolution)
       ↓
MiddlewarePipeline (pre/post job processing hooks)
       ↓
FailedJobStore (dead-letter storage for exhausted retries)
```

---

## 3. Key Components

### 3.1 QueueManager

- Central orchestrator managing named queue connections, workers, and lifecycle.
- Resolves driver instances via registered `QueueDriverFactory` functions.
- Provides convenience methods: `dispatch()`, `delay()`, `schedule()`.
- Creates and manages `Worker` instances with merged configuration defaults.
- Graceful `close()` shutting down all workers and driver connections in parallel.

### 3.2 Queue

- Named queue handle wrapping an `IQueueDriver` for a specific queue name.
- Constructs immutable `Job` objects with generated IDs, timestamps, and retry policies.
- Provides `dispatch<Payload>()`, `delay<Payload>()`, `schedule<Payload>()`, `depth()`, `stats()`, and `clear()`.

### 3.3 IQueueDriver

Low-level driver contract implemented by all queue backends:

- `enqueue<Payload>`: Adds a job to the queue.
- `claim<Payload>`: Claims pending jobs with visibility lease for exclusive processing.
- `acknowledge`: Marks a job as successfully completed.
- `release`: Returns a job to the queue for retry with optional delay.
- `fail`: Permanently marks a job as failed.
- `cancel`: Cancels a pending/scheduled job.
- `getJob<Payload>`, `getQueueDepth`, `getStats`, `clear`, `close`.
- Exposes `QueueCapabilities` declaring supported features (priority, delayed jobs, visibility leases).

### 3.4 Worker

- Long-running polling process that claims and executes jobs.
- Configurable concurrency, polling interval, idle backoff (linear), and lease timeout.
- Job timeout enforcement via `AbortSignal` with `JobTimeoutError`.
- Retry orchestration using `RetryCalculator` (fixed or exponential backoff with optional jitter).
- Failed job routing to `IFailedJobStore` after retry exhaustion.
- Graceful shutdown with configurable `shutdownTimeoutMs`.
- Supports `--once` mode for single-pass execution (CI/testing).

### 3.5 JobRegistry

- Type-safe mapping of job type strings to `JobDefinition` objects.
- Prevents duplicate registrations.
- Resolves handlers, default retry policies, and timeout values at dispatch time.

### 3.6 RetryCalculator

- Computes retry delays based on `RetryPolicy`:
  - `fixed`: Constant delay between retries.
  - `exponential`: Doubling delay with configurable `maxDelayMs` cap.
  - Optional `jitter`: Adds ±25% randomization to prevent retry storms.

### 3.7 MiddlewarePipeline (Queue)

- Separate from HTTP middleware — follows the same onion pattern but scoped to job execution.
- Each middleware wraps job handlers with pre/post processing hooks.
- Used for logging, metrics, tracing, and error enrichment around job execution.

### 3.8 FailedJobStore

- Dead-letter storage for jobs that exhaust all retry attempts.
- `IFailedJobStore` interface with `record()`, `list()`, `get()`, `remove()`, `clear()`, `count()`.
- Built-in `MemoryFailedJobStore` for development; database-backed implementation follows the same contract.

---

## 4. Driver Implementations

### 4.1 MemoryQueueDriver

- In-process `Map`-based queue storage.
- Supports all `QueueCapabilities`: priority sorting, delayed jobs, visibility leases.
- Deterministic behavior ideal for testing and local development.

### 4.2 DatabaseQueueDriver

- Persistent queue storage using `@django-js/database` connection pooling and queries.
- Uses `locked_until` column for visibility lease enforcement in multi-worker environments.
- Claims jobs with `UPDATE ... WHERE locked_until < NOW()` pattern for distributed locking.
- Suitable for production workloads without external dependencies (Redis/RabbitMQ).

---

## 5. Job Lifecycle

```
dispatch() → [pending]
               ↓
           Worker.claim() → [processing]
               ↓
          Job Handler executes
         ╱                    ╲
    Success                  Failure
       ↓                       ↓
  acknowledge()         attempts < maxAttempts?
  → [completed]         ╱              ╲
                     Yes               No
                      ↓                 ↓
                  release()          fail()
                  → [pending]        → [failed]
                  (with delay)       → FailedJobStore
```

---

## 6. CLI Integration

| Command                           | Description                                           |
| :-------------------------------- | :---------------------------------------------------- |
| `queue:work [--once] [--queue]`   | Starts a worker process; `--once` for single-pass.    |
| `queue:status [--queue] [--json]` | Reports queue metrics (pending, processing, failed).  |
| `queue:failed [--json]`           | Lists failed jobs from the dead-letter store.         |
| `queue:retry [--id] [--all]`      | Retries specific or all failed jobs.                  |
| `queue:clear [--queue] [--force]` | Clears all jobs from a queue with confirmation guard. |

---

## 7. Testing

- **Contract Tests** (`contract.ts`): Reusable test suite validating any `IQueueDriver` implementation.
- **Unit Tests**: Worker lifecycle, retry calculation, middleware pipeline, registry, shutdown.
- **Integration Tests**: Database driver with visibility leases and multi-worker scenarios.
- **Fake Driver** (`FakeQueueDriver`): Testing utility for application-level test isolation.
