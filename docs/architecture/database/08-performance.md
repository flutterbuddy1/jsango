# Database Performance & Benchmarks

`@jsango/database` is architected for high-concurrency environments, avoiding unnecessary memory allocations, intermediate promises, and heavy abstractions in hot paths.

## Key Performance Design Decisions

1. **Lightweight Connection Pool**: The internal pool uses array-backed index operations and an asynchronous waiter queue rather than heavyweight third-party polling libraries.
2. **Precompiled Dialect Regex**: Dialect placeholder substitutions skip allocation when matching the native driver dialect (e.g., question mark dialects do no conversions).
3. **No Dynamic SQL Generation in Hot Path**: Raw parameterized queries dispatch directly to the driver with zero statement AST compilation overhead.

## Benchmark Results

Measured on Apple Silicon via `benchmarks/database/database.bench.ts`:

| Operation                               | Throughput (ops/sec)  | Mean Latency | p99 Latency |
| :-------------------------------------- | :-------------------- | :----------- | :---------- |
| **Connection acquisition from pool**    | **3,105,512 ops/sec** | 0.0003 ms    | 0.0005 ms   |
| **Connection release back to pool**     | **3,291,735 ops/sec** | 0.0003 ms    | 0.0005 ms   |
| **Dialect placeholder normalization**   | **2,677,916 ops/sec** | 0.0004 ms    | 0.0005 ms   |
| **Parameterized query execution**       | **2,265,931 ops/sec** | 0.0004 ms    | 0.0006 ms   |
| **Transaction creation & rollback**     | **1,272,845 ops/sec** | 0.0008 ms    | 0.0012 ms   |
| **Transaction creation & commit**       | **1,229,903 ops/sec** | 0.0008 ms    | 0.0012 ms   |
| **Full DatabaseManager query dispatch** | **1,006,251 ops/sec** | 0.0010 ms    | 0.0018 ms   |
| **Savepoint creation & rollback**       | **786,146 ops/sec**   | 0.0013 ms    | 0.0019 ms   |
| **Credential masking in strings**       | **681,171 ops/sec**   | 0.0015 ms    | 0.0020 ms   |
