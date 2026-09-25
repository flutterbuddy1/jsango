# Performance & Hardening Guide (`docs/performance`)

## Overview

JSango is designed from the ground up for high-concurrency workloads, zero unnecessary allocations in hot paths, and bounded memory usage.

This directory documents:

- **[Phase 15 Performance Report](file:///Users/mayankdiwakar/Documents/Development/jsango/docs/performance/PHASE-15-REPORT.md)**: Comprehensive before/after measurements, bottleneck analyses, and optimization trade-offs.
- **Methodology & Tooling**: Microbenchmarks, concurrency load testing, and memory leak regression suites.
- **Production Tuning**: Guidelines for configuring pools, workers, timeouts, and sampling in production environments.

---

## Benchmark Suite Organization

Benchmarks reside in the root `benchmarks/` directory and are executed via Vitest:

```bash
# Run all framework benchmarks
npx vitest bench --run benchmarks

# Run targeted benchmark suites
npx vitest bench --run benchmarks/router
npx vitest bench --run benchmarks/http
npx vitest bench --run benchmarks/container
npx vitest bench --run benchmarks/orm
npx vitest bench --run benchmarks/cache
npx vitest bench --run benchmarks/queue
npx vitest bench --run benchmarks/events
npx vitest bench --run benchmarks/websocket
npx vitest bench --run benchmarks/admin
npx vitest bench --run benchmarks/openapi
npx vitest bench --run benchmarks/observability
```

---

## Core Optimization Principles

1. **Evidence-Driven**: Every optimization starts with an automated benchmark and profiling evidence.
2. **Zero Security Compromise**: High throughput must never bypass authentication, authorization, validation, or PII redaction.
3. **Immutable Caching**: Frozen, pre-computed representations for static route trees, ORM metadata, and Admin schemas.
4. **Bounded State & Cardinality Defense**: Strict limits on metric label cardinality (1,000 max), LRU cache entry limits, and WebSocket buffer sizes.
5. **Deterministic Cleanup**: Immediate, synchronous disposal of scoped DI containers, connection releases, and room memberships.
