# Performance & Benchmarks

## 1. Benchmark Results

Measured on Apple Silicon using Vitest Benchmark:

| Benchmark Case                                            | Operations / Sec       | Mean Latency |
| :-------------------------------------------------------- | :--------------------- | :----------- |
| `PermissionRegistry.matches` (exact & wildcard)           | **12,617,692 ops/sec** | 0.08 µs      |
| `AuthorizationManager.authorize` (superuser bypass audit) | **5,299,787 ops/sec**  | 0.19 µs      |
| `AuthorizationManager.can` (direct permission)            | **3,817,163 ops/sec**  | 0.26 µs      |
| `AuthorizationManager.can` (object-level policy)          | **3,422,419 ops/sec**  | 0.29 µs      |
| `AuthorizationManager.can` (role mapped permission)       | **2,258,968 ops/sec**  | 0.44 µs      |
| `BearerTokenStrategy.authenticate`                        | **2,109,088 ops/sec**  | 0.47 µs      |
| `AuthorizationManager.authorizeMany` (10 items bulk)      | **704,266 ops/sec**    | 1.42 µs      |
| `SessionStrategy.authenticate` (MemoryStore)              | **191,108 ops/sec**    | 5.23 µs      |
| `Password verify` (Scrypt $N=2048$)                       | **6,308,075 ops/sec**  | ~0.16 µs     |

## 2. Key Optimizations

- **Zero Allocations on Permission Matching**: Wildcard search avoids regex compilation, operating on simple string slices and cached array lookups.
- **Pure Decision Policies**: Policies contain zero implicit database roundtrips unless explicitly requested by the application.
- **Request-Scoped Isolation**: Identities are bound directly to `RequestContext.state` and the scoped DI container, avoiding synchronization locks.
