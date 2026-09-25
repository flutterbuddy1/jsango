# ORM Performance & Benchmarks

## Performance Architecture

`@jsango/orm` is optimized for high-throughput, low-latency microservices and high-concurrency server workloads:

1. **Zero Runtime Reflection**: Does not use TypeScript experimental decorator reflection (`reflect-metadata`), eliminating runtime overhead and startup penalties.
2. **Immutable Cloned Builders**: Query builders use lightweight shallow copies of AST structures for query chaining (4.05M ops/sec).
3. **Dirty-Aware Updates**: Skips database queries when models are un-dirty, saving network latency.
4. **Batch Eager Loading**: Resolves related records using single `WHERE IN (...)` queries, eliminating N+1 overhead.
5. **Streaming Cursors**: Memory-efficient batch streaming via `cursor()` prevents out-of-memory errors on large datasets.

---

## Benchmark Results

Benchmark executed on Apple Silicon (Vitest Bench v3.2.7):

| Benchmark Scenario                            | Throughput (ops/sec) | Mean Latency (ms) | P99 Latency (ms) |
| :-------------------------------------------- | :------------------- | :---------------- | :--------------- |
| **1. Model metadata lookup**                  | **25,306,556**       | 0.0000 ms         | 0.0000 ms        |
| **2. Model instance creation**                | **15,036,285**       | 0.0001 ms         | 0.0001 ms        |
| **3. Model hydration from raw rows**          | **2,237,510**        | 0.0004 ms         | 0.0006 ms        |
| **4. Query AST compilation**                  | **1,315,444**        | 0.0008 ms         | 0.0011 ms        |
| **5. QueryBuilder cloning throughput**        | **4,052,348**        | 0.0002 ms         | 0.0003 ms        |
| **6. Simple SELECT query via ORM**            | **97,888**           | 0.0102 ms         | 0.0134 ms        |
| **7. Bulk insert throughput (10 items)**      | **182,537**          | 0.0055 ms         | 0.0069 ms        |
| **8. Bulk update throughput**                 | **71,641**           | 0.0140 ms         | 0.0181 ms        |
| **9. Relation eager loading (users + posts)** | **33,863**           | 0.0295 ms         | 0.0435 ms        |
| **10. Pagination execution (page 1, size 5)** | **162,903**          | 0.0061 ms         | 0.0077 ms        |
| **11. COUNT aggregation**                     | **125,642**          | 0.0080 ms         | 0.0099 ms        |
| **12. Transaction-backed ORM persistence**    | **9,581**            | 0.1044 ms         | 0.5306 ms        |

---

## Memory Efficiency

- **Model Metadata**: Created once at startup and frozen; shared across all requests.
- **Model Instances**: Lightweight plain objects backed by prototype getters; zero extra wrapper objects.
- **Cursor Streaming**: Yields records batch by batch, allowing processing of 1,000,000+ rows with constant memory footprint.
