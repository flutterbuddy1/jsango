# ADR-035: Dependency Injection Scoped and Singleton Fast-Path

## Status

Accepted

## Context

During every HTTP request, multiple services (repositories, logger, auth context, cache stores) are resolved repeatedly across controllers, services, and middlewares from the scoped child container.

## Decision

1. Check the local `this.instances` map at the top of `Container.resolve()` before performing binding lookups, parent traversals, or circular dependency stack tracking.
2. Delegate singletons directly to parent containers when in child scopes.
3. Cache instantiated scoped services immediately within the local scope instance map.

## Consequences

- Scoped resolution throughput improved from ~17.6M ops/sec to **24.1M+ ops/sec** (37% improvement).
- Singleton cached resolution achieves **21.5M+ ops/sec**.
- Preserves full lifecycle management and `onDispose` execution guarantees.
