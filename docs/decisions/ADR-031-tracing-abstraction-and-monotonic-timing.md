# ADR-031: Tracing Abstraction and Monotonic Timing

## Status

Accepted

## Context

Tracing execution durations with wall-clock time (`Date.now()`) leads to inaccuracies caused by NTP clock adjustments or leap seconds. Moreover, tracing in hot paths must have negligible allocation overhead when disabled or sampled out.

## Decision

1. Implement `Tracer`, `Span`, and `NoopSpan` abstractions using `performance.now()` high-resolution monotonic time.
2. Support deterministic sampling strategies (`always`, `never`, `probability`, and custom `SamplerFn`).
3. Return zero-allocation `NoopSpan` instances when tracing is sampled out or disabled.
4. Record span attributes, events, and status codes (`unset`, `ok`, `error`).

## Consequences

- Accurate nanosecond-to-microsecond latency measurements unaffected by clock skew.
- Near-zero overhead for un-sampled spans.
