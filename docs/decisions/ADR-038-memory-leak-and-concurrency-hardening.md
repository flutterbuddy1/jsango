# ADR-038: Memory Leak Prevention and Concurrency Hardening

## Status

Accepted

## Context

Production services running under high concurrency must guarantee that request contexts, database connections, cache keys, and WebSocket room memberships are completely freed without memory leaks.

## Decision

1. Introduce automated regression tests in `tests/performance/leak.test.ts` verifying memory bounds over 5,000+ request lifecycles, 5,000+ child container scopes, 1,000+ WebSocket room joins/leaves, and cache TTL prunes.
2. Introduce concurrency load tests in `tests/performance/concurrency.test.ts` executing 1,000 concurrent HTTP requests and 1,000 concurrent event dispatches.
3. Enforce strict `try...finally` resource disposal across all middleware and database wrappers.

## Consequences

- Verified absence of memory leaks, retained event listeners, and unclosed timers.
- Predictable memory footprint under heavy concurrent traffic.
