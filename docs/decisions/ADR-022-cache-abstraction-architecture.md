# ADR-022: Cache Abstraction Architecture

## Context

Production applications require caching for performance optimization (query results, computed values, session data, API responses). The framework needs a unified caching layer that abstracts storage backends while providing features like TTL, namespacing, stampede protection, and graceful fallback for distributed cache failures.

## Decision

1. **Driver-Based Architecture**:
   - All cache backends implement the `ICacheDriver` contract with explicit `CacheCapabilities`.
   - `CacheManager` orchestrates multiple named stores, each backed by an independently configured driver.
   - Built-in `MemoryCacheDriver` ships as default; Redis support follows the same contract.
2. **Layered Design**:
   - `CacheStore` wraps drivers with key normalization (`CacheKeyBuilder`), serialization (`SafeCacheSerializer`), stampede protection, and statistics tracking.
   - Namespaced cache partitioning via `CacheStore.namespace()` returns a scoped store without driver-level namespace support requirements.
3. **Stampede Protection**:
   - `remember()` / `getOrSet()` use a local `Promise`-based concurrent lock map preventing thundering herd on cache misses.
   - Only the first caller executes the factory; concurrent callers await the same Promise.
4. **Fallback Modes**:
   - `fail-fast` (default): Errors propagate immediately.
   - `fallback-to-memory`: Transparent degradation to an in-memory store.
   - `bypass`: Returns defaults without caching, factory still executes.
5. **Serialization Safety**:
   - `SafeCacheSerializer` handles `Date` (ISO 8601), `BigInt` (string), and plain objects.
   - Rejects functions, symbols, and closures to prevent non-serializable data corruption.
6. **Key Validation**:
   - ASCII control characters rejected via regex.
   - Hierarchical key construction: `{application}:{environment}:{prefix}:{namespace}:{key}`.

## Consequences

- Applications interact with a stable, typed `ICacheStore` API regardless of backend.
- Driver implementations can be swapped without application code changes.
- Stampede protection eliminates a common production failure mode.
- No mandatory external dependencies for development or testing.
