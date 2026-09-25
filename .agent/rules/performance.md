---
trigger: always_on
---

# Performance Rules

JSango is designed for high-concurrency workloads.

Performance-sensitive code must:

- avoid unnecessary allocations
- avoid unnecessary abstraction in hot paths
- reuse resources
- avoid synchronous blocking
- use connection pooling
- use efficient routing
- use efficient serialization

Do not optimize based on assumptions.

Benchmark before and after performance-sensitive changes.

Every optimization must include:

1. reason
2. benchmark
3. measurable result

Do not claim performance superiority without benchmark evidence.