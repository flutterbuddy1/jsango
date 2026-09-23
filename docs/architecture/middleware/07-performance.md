# Middleware & Lifecycle Performance

## Performance Invariants

The request lifecycle is engineered for sub-microsecond overhead in the hot path:

- **Zero Unnecessary Allocations**: Middleware execution creates minimal closures per request.
- **Single-Pass Dispatch**: Route matching occurs once per request.
- **Fast Response Normalization**: Type checks are branch-ordered by likelihood (HttpResponse first, then text, then JSON).
- **Lightweight Scopes**: Container scope creation simply links a child container reference; scope disposal clears only per-request caches.

## Microbenchmark Results

Measured using Vitest benchmark runner on modern hardware (`benchmarks/middleware/middleware.bench.ts`):

| Operation                                                             | Throughput (ops/sec) | Average Latency |
| :-------------------------------------------------------------------- | :------------------- | :-------------- |
| **Request Scope Creation & Disposal**                                 | ~5,000,000+ ops/s    | ~0.20 µs        |
| **Response Normalization**                                            | ~3,000,000+ ops/s    | ~0.30 µs        |
| **Empty Middleware Pipeline Dispatch**                                | ~2,900,000+ ops/s    | ~0.35 µs        |
| **Single Middleware Pipeline Dispatch**                               | ~1,100,000+ ops/s    | ~0.90 µs        |
| **Full Lifecycle (MW + Router + Scoped DI + Handler)**                | ~750,000+ ops/s      | ~1.30 µs        |
| **5 Middlewares + Handler**                                           | ~700,000+ ops/s      | ~1.40 µs        |
| **10-Layer Middleware Pipeline**                                      | ~500,000+ ops/s      | ~2.00 µs        |
| **Error Pipeline (Throw $\rightarrow$ Catch $\rightarrow$ Mask 500)** | ~200,000+ ops/s      | ~5.00 µs        |
