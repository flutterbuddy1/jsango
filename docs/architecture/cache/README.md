# @jsango/cache Architecture Overview

## 1. Core Mission & Philosophy

`@jsango/cache` provides a production-grade, driver-agnostic caching abstraction for the JSango (`jsango`) framework. It is designed around the principle that caching is infrastructure, not domain logic — the application layer interacts with a high-level `CacheStore` interface, while backend storage details are encapsulated behind pluggable drivers.

Key design principles:

- **Driver Abstraction**: All storage backends implement a single `ICacheDriver` contract.
- **Named Stores**: Multiple cache stores can coexist (`default`, `sessions`, `api-responses`), each with independent drivers and configuration.
- **Stampede Protection**: `remember()` / `getOrSet()` operations use Promise-based locking to prevent thundering herd on cache misses.
- **Namespace Isolation**: Logical cache partitioning via `namespace()` without driver-level support requirements.
- **Fallback Resilience**: Configurable behavior (`fail-fast`, `fallback-to-memory`, `bypass`) when the primary store is unavailable.
- **Zero Mandatory External Dependencies**: Ships with `MemoryCacheDriver` for development and testing; Redis adapter follows the same driver contract.

---

## 2. Architecture Layers

```
Application Code
       ↓
CacheManager (orchestrator)
       ↓
CacheStore (high-level operations, stampede protection, namespacing, stats)
       ↓
CacheKeyBuilder (key normalization, prefixing, validation)
       ↓
SafeCacheSerializer (JSON serialization with Date/BigInt support)
       ↓
ICacheDriver (raw storage backend)
  ├── MemoryCacheDriver (built-in, LRU-capable)
  └── RedisAdapter (external adapter)
```

---

## 3. Key Components

### 3.1 CacheManager

- Central orchestrator managing multiple named cache stores.
- Resolves driver instances via registered `CacheDriverFactory` functions.
- Provides high-level convenience methods that delegate to the default store.
- Implements fallback modes for distributed cache failures.
- Manages lifecycle shutdown (`close()`) for all initialized stores.

### 3.2 CacheStore

- High-level cache interface exposed to application code.
- Wraps `ICacheDriver` with:
  - `CacheKeyBuilder` for safe key normalization and namespacing.
  - `SafeCacheSerializer` for transparent value serialization.
  - Stampede protection via `remember()` using a concurrent `Promise` lock map.
  - Hit/miss/set/delete/error statistics tracking.
- Supports `namespace()` for logical cache partitioning.

### 3.3 ICacheDriver

Low-level driver contract implemented by all storage backends:

- `get<T>`, `set<T>`, `has`, `delete`, `clear`
- `increment`, `decrement`
- `expire`, `ttl`
- `getMany<T>`, `setMany<T>`, `deleteMany` (batch operations)
- `close()` (lifecycle cleanup)
- Exposes `CacheCapabilities` declaring supported features.

### 3.4 CacheKeyBuilder

- Normalizes and validates cache keys against ASCII control characters.
- Constructs namespaced, prefixed keys: `{application}:{environment}:{prefix}:{namespace}:{key}`.
- Enforces maximum key length constraints.

### 3.5 SafeCacheSerializer

- JSON-based serialization with custom replacer/reviver functions.
- Handles non-standard JSON types: `Date` (ISO 8601 round-trip), `BigInt` (string representation).
- Rejects non-serializable values (functions, symbols) with descriptive errors.

---

## 4. Driver Implementations

### 4.1 MemoryCacheDriver

- In-process `Map`-based storage with passive TTL expiration on access.
- Configurable `maxEntries` for LRU-style bounded caching.
- Full `CacheCapabilities` support: TTL, increment/decrement, multi-key, batch operations.
- Deterministic behavior ideal for testing and local development.

### 4.2 RedisAdapter

- Adapter interface for connecting to external Redis instances.
- Follows identical `ICacheDriver` contract for seamless swapping.
- Redis-specific features (pub/sub, Lua scripts) are not exposed through the generic driver contract.

---

## 5. Fallback Modes

| Mode                  | Behavior                                                             |
| :-------------------- | :------------------------------------------------------------------- |
| `fail-fast` (default) | Primary store error propagates immediately to the caller.            |
| `fallback-to-memory`  | Transparently falls back to an in-memory store on primary failure.   |
| `bypass`              | Returns default/empty values without caching; factory still invoked. |

---

## 6. CLI Integration

- `cache:clear [--store <name>] [--force]`: Clears a named cache store with destructive confirmation guard.

---

## 7. Testing

- **Contract Tests** (`contract.ts`): Reusable test suite validating any `ICacheDriver` implementation against the full contract.
- **Unit Tests**: Serializer, key builder, store, manager, stampede protection, and Redis adapter.
- **Fake Store** (`FakeCacheDriver`): Testing utility providing a minimal in-memory driver for application-level test isolation.
