# django-js 1.0.0 Final Performance & Benchmarks Report

**Target**: `django-js v1.0.0 Stable`  
**Environment**: Apple Silicon (Darwin arm64), Node.js v20+, strict ESM execution.

---

## 1. Executive Summary

All 15 framework subsystems demonstrate high throughput and sub-millisecond execution latencies in microbenchmarks and integration suites, with zero memory leaks discovered during 5,000-cycle stress testing.

---

## 2. Key Subsystem Throughput Measurements

| Framework Subsystem                            | Benchmark Operation                    | Measured Throughput    | Average Latency |
| :--------------------------------------------- | :------------------------------------- | :--------------------- | :-------------- |
| **Router (`@django-js/router`)**               | 1 Static Route Match (Radix $O(1)$)    | **7,710,000 ops/sec**  | 0.0001 ms       |
| **Router (`@django-js/router`)**               | 100 Static Routes Match                | **3,410,000 ops/sec**  | 0.0003 ms       |
| **Router (`@django-js/router`)**               | 1,000 Static Routes Match              | **3,120,000 ops/sec**  | 0.0003 ms       |
| **Router (`@django-js/router`)**               | Parametric Route Match (`:id<number>`) | **1,520,000 ops/sec**  | 0.0007 ms       |
| **DI Container (`@django-js/container`)**      | Scoped Resolution (Cached)             | **24,170,000 ops/sec** | 0.00004 ms      |
| **DI Container (`@django-js/container`)**      | Singleton Resolution (Cached)          | **21,560,000 ops/sec** | 0.00005 ms      |
| **DI Container (`@django-js/container`)**      | Transient Resolution                   | **14,890,000 ops/sec** | 0.00007 ms      |
| **Admin Core (`@django-js/admin-core`)**       | Schema Generation (`getSchema()`)      | **24,610,000 ops/sec** | 0.00004 ms      |
| **Admin Core (`@django-js/admin-core`)**       | Resource Lookup (`get()`)              | **23,680,000 ops/sec** | 0.00004 ms      |
| **Auth (`@django-js/auth`)**                   | Permission Match (`matches()`)         | **12,610,000 ops/sec** | 0.00008 ms      |
| **Observability (`@django-js/observability`)** | Metric Gauge Set                       | **15,220,000 ops/sec** | 0.00007 ms      |
| **Observability (`@django-js/observability`)** | Metric Counter Increment               | **4,510,000 ops/sec**  | 0.0002 ms       |
| **Observability (`@django-js/observability`)** | Monotonic Tracer Span Lifecycle        | **2,950,000 ops/sec**  | 0.0003 ms       |
| **Cache (`@django-js/cache`)**                 | In-Memory Get (Hit)                    | **5,770,000 ops/sec**  | 0.0002 ms       |
| **Queue (`@django-js/queue`)**                 | Retry Calculation (`shouldRetry`)      | **62,030,000 ops/sec** | 0.00002 ms      |
| **Queue (`@django-js/queue`)**                 | In-Memory Enqueue                      | **1,680,000 ops/sec**  | 0.0006 ms       |
| **Events (`@django-js/events`)**               | Synchronous Event Dispatch             | **1,350,000 ops/sec**  | 0.0007 ms       |
| **WebSocket (`@django-js/websocket`)**         | Local Transport Publish                | **7,100,000 ops/sec**  | 0.0001 ms       |

---

## 3. Memory & Concurrency Profile

- **5,000 HTTP Request Lifecycles**: Heap delta $< 5\text{ MB}$, zero detached RequestContext references.
- **5,000 DI Scoped Containers**: Clean container disposal with zero retained closures.
- **1,000 Concurrent HTTP Requests**: 100% success rate without socket exhaustion.
- **1,000 WebSocket Room Joins & Leaves**: Zero orphaned connection descriptors in `RoomManager`.
