# 01 — Framework Architecture Overview

## Project Identity & Vision

**django-js** is a production-grade, batteries-included TypeScript backend framework designed specifically for modern JavaScript runtimes (Node.js and Bun) and high-concurrency workloads.

The framework is inspired by:

- **Django's** convention-over-configuration philosophy and batteries-included developer experience
- **Laravel's** expressive ergonomics and routing simplicity
- **Modern TypeScript** type safety and developer tooling
- **High-performance JavaScript runtimes** with zero unnecessary allocations and non-blocking I/O

django-js is NOT a clone of Django, Express, Fastify, or NestJS. It establishes its own cohesive architecture, explicit interfaces, and lightweight runtime design.

---

## Core Principles

1. **TypeScript-First**: Written in strict TypeScript with zero compromises on type safety (`strict: true`, no `any`).
2. **Convention over Configuration**: Sensible, secure defaults out of the box while allowing full customization when necessary.
3. **Explicit over Magical Behavior**: No hidden global state, reflection-heavy automagic, or opaque monkey-patching.
4. **Dependency Inversion**: High-level policies do not depend on low-level details. All infrastructure concerns sit behind explicit interfaces.
5. **Modular Architecture**: Monorepo packages with single, well-defined responsibilities.
6. **High Performance**: Designed from the ground up for high concurrency, minimal allocations in hot paths, and efficient routing.
7. **Security by Default**: Built-in safeguards against injection, traversal, parameter pollution, and information leakage.
8. **Testability**: Highly testable design with clean dependency injection, zero global mutable state, and deterministic execution.
9. **Minimal Runtime Overhead**: Lightweight primitives without heavyweight third-party abstraction baggage.

---

## Architectural Layers

Execution flows strictly through well-defined architectural layers:

```
Runtime (Node.js / Bun)
   ↓
Core (Lifecycle, Errors, Logging)
   ↓
Container (Dependency Injection & Scopes)
   ↓
Config (Environment & Settings)
   ↓
HTTP (Request / Response Abstractions)
   ↓
Router (Matching & Dispatching)
   ↓
Middleware (Pipeline & Interceptors)
   ↓
Application Layer (Controllers / Services / Domain)
   ↓
ORM (Models & Query Builders)
   ↓
Database (Connections, Drivers & Transactions)
```

Lower-level layers never import higher-level layers, preserving clean boundaries and ensuring testability and modularity.
