# ADR-029: Observability Architecture and Correlation Propagation

## Status

Accepted

## Context

High-concurrency distributed systems require unified logging, metrics, and tracing abstractions without tightly binding the framework core to specific vendor SDKs (e.g. Datadog, New Relic, Prometheus, OpenTelemetry).

## Decision

1. Implement `@jsango/observability` as an infrastructure-level package that interacts with HTTP, Queue, Events, Database, and WebSocket via clean interfaces.
2. Provide `StructuredLogger` implementing `ILogger` with scoped context chaining (`withContext`) and automatic log-injection prevention (escaping control characters).
3. Introduce `CorrelationManager` to validate and sanitize incoming `x-request-id` headers (alphanumeric + `-._` up to 128 chars) or generate unique UUIDv4 identifiers, and parse/format W3C `traceparent` headers.
4. Propagate request IDs and trace contexts across async boundaries and background jobs without using global mutable state.

## Consequences

- Clean separation between framework abstractions and external APM platforms.
- Complete auditability and distributed correlation across all framework subsystems.
