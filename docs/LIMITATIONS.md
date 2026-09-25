# jsango Framework Limitations & Architectural Boundaries

This document provides a transparent, honest overview of the architectural limitations, runtime boundaries, and current scope of the `jsango` framework as of `0.1.0-rc.1`.

---

## 1. Runtime Environment Support

- **Node.js**: Requires Node.js `>=20.0.0` (active LTS or newer) utilizing native ECMAScript Modules (`"type": "module"`).
- **Bun / Deno**: The core HTTP, Container, Router, Validation, and ORM packages are designed with runtime independence abstractions (`IRuntimeAdapter`). However, dedicated Bun/Deno platform adapters are planned for post-1.0 milestones.
- **CommonJS**: The framework is strictly ESM-first. CJS consumers must use dynamic `import()` to consume `@jsango/*` packages.

---

## 2. Database & ORM Boundaries

- **Supported SQL Dialects**: Built-in AST compilers support standard ANSI SQL, PostgreSQL placeholder conventions (`$1`), and SQLite/MySQL parameter placeholders (`?`).
- **Transactional DDL**: Distributed migration transaction guarantees depend on underlying database engine capabilities (PostgreSQL supports transactional DDL; MySQL does not).
- **Implicit Lazy Loading Ban**: Implicit property-access lazy loading (e.g. `user.posts` making an implicit query) is strictly forbidden and unsupported to prevent N+1 queries. All relationship loading must be declared upfront via `.with('posts')`.

---

## 3. Real-Time & WebSockets

- **Single-Node vs Multi-Node**: The default `LocalTransport` broadcasts WebSocket messages within a single Node.js process. Horizontal clustering across multiple server instances requires plugging in a distributed transport adapter (e.g. Redis pub/sub).
- **Message Framing**: Built-in framing standardizes on UTF-8 JSON envelopes (`{ type, payload, requestId, metadata }`). Binary streaming protocols (e.g. raw Protobuf or binary audio streams) require custom WebSocket handlers.

---

## 4. Background Queues & Jobs

- **Delivery Semantics**: The queue subsystem enforces **at-least-once** delivery. Job handlers must be written to be idempotent.
- **Worker Concurrency**: Process concurrency is bounded by the Node.js event loop. CPU-intensive background tasks should be scheduled with lower concurrency or offloaded to worker threads / dedicated worker nodes.

---

## 5. Caching

- **Stampede Lock Scope**: The default Promise-based stampede lock (`remember()`) is process-local. In horizontally scaled environments, multiple instances may simultaneously query the backing datastore on cache misses unless a distributed lock manager is configured.

---

## 6. Observability

- **High-Cardinality Metric Label Protection**: `MetricRegistry` enforces a maximum cardinality limit (default 1,000 label permutations per metric). High-entropy inputs (such as raw user IDs or UUIDs in label keys) will be rejected to prevent unbounded memory growth.
