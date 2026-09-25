# ADR-037: Tracing NoopSpan Singleton Allocation Reduction

## Status

Accepted

## Context

When tracing is disabled or when spans are unsampled, starting and ending spans in high-frequency hot paths (such as database queries or router matches) must not allocate unnecessary objects.

## Decision

1. Introduce a frozen `NoopSpan.INSTANCE` singleton on `NoopSpan`.
2. Return `NoopSpan.INSTANCE` directly from `Tracer.startSpan()` whenever tracing is disabled or unsampled.

## Consequences

- Zero heap allocation for disabled/unsampled spans.
- No impact on sampled spans or context propagation accuracy.
