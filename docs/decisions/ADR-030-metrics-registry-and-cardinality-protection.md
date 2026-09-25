# ADR-030: Metrics Registry and Cardinality Protection

## Status

Accepted

## Context

Unbounded metric label values (such as raw user IDs, emails, query parameters, or arbitrary exception messages) can cause memory exhaustion and crash the application process or downstream metrics backends.

## Decision

1. Implement `MetricRegistry` supporting monotonic `Counter`, stateful `Gauge`, and distribution `Histogram` primitives.
2. Enforce a configurable `maxCardinalityPerMetric` threshold (default 1,000 label permutations per metric).
3. Drop new label combinations once the cardinality threshold is reached to protect process stability.
4. Export snapshots in a backend-neutral representation (`MetricSnapshot`) compatible with future Prometheus or OpenTelemetry exporters.

## Consequences

- Deterministic, bounded memory usage for metrics collection.
- Safe metrics collection in high-throughput production environments.
