# django-js

> Production-grade, batteries-included TypeScript backend framework designed for modern JavaScript runtimes and high-concurrency workloads.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Version: 1.0.0](https://img.shields.io/badge/version-1.0.0-green.svg)](CHANGELOG.md)
[![TypeScript: Strict](https://img.shields.io/badge/TypeScript-Strict%205.8-blue.svg)](tsconfig.base.json)

---

## Overview

**django-js** combines the convention-over-configuration philosophy, developer ergonomics, and built-in batteries of Django with modern TypeScript type safety, modular package architecture, and the high-throughput performance of contemporary JavaScript runtimes (Node.js 20+).

### Core Principles

- **TypeScript-First**: Strict type safety throughout (`strict: true`, zero `any`, strict null checks).
- **Convention Over Configuration**: Opinionated, secure defaults with extensive configurability.
- **Explicit Over Magical**: Zero monkey-patching or opaque runtime reflection on hot execution paths.
- **Runtime Independent**: Clean runtime abstraction supporting Node.js today and modern JavaScript runtimes.
- **High Performance**: Designed from day one for high concurrency, zero-allocation hot paths (>7.7M route lookups/sec), and non-blocking I/O.
- **Security by Default**: Built-in protections against SQL injection, CSRF, CRLF header injection, path traversal, and sensitive credential leakage.

---

## Quick Start

### 1. Scaffolding a New Application

```bash
# Create a new django-js project using the CLI
npx django-js create my-app
cd my-app
pnpm install
```

### 2. Application Example

```typescript
import { Application } from '@django-js/middleware';
import { defineModel, fields } from '@django-js/orm';

// 1. Define Model
export const User = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    id: fields.uuid({ primaryKey: true }),
    email: fields.string({ unique: true }),
    name: fields.string(),
  },
});

// 2. Instantiate Application
const app = new Application({ isProduction: process.env.NODE_ENV === 'production' });

app.get('/api/users/:id', async (ctx) => {
  const id = ctx.request.params['id'];
  const user = await User.query().where('id', '=', id).first();
  if (!user) {
    return ctx.response.notFound({ error: 'User not found' });
  }
  return user.toJSON();
});

// 3. Start Server
const server = await app.listen(3000, '0.0.0.0');
console.log('Server running on http://localhost:3000');
```

---

## Monorepo Packages (`v1.0.0`)

| Package                                              | Purpose & Responsibility                                                                       |
| :--------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| [`@django-js/runtime`](packages/runtime)             | Runtime abstraction and platform adapters (Node.js)                                            |
| [`@django-js/core`](packages/core)                   | Application lifecycle coordinator, structured error hierarchy, and logging abstractions        |
| [`@django-js/container`](packages/container)         | High-performance DI container supporting transient, singleton, and scoped lifetimes            |
| [`@django-js/config`](packages/config)               | Centralized, immutable configuration provider with type casting and schema validation          |
| [`@django-js/http`](packages/http)                   | Runtime-independent HTTP request/response abstractions and streaming body parsers              |
| [`@django-js/router`](packages/router)               | Segment Radix Trie router (>7.7M ops/sec), typed parameter constraints, and route groups       |
| [`@django-js/middleware`](packages/middleware)       | Onion-style middleware pipeline, response normalization, and application coordinator           |
| [`@django-js/database`](packages/database)           | Multi-connection manager, FIFO connection pool, and scoped transaction state machines          |
| [`@django-js/orm`](packages/orm)                     | Declarative models, AST query builder, and pure batch eager loading (`.with()`)                |
| [`@django-js/migrations`](packages/migrations)       | Schema diffing engine, DDL compilers, distributed locks, and migration runner                  |
| [`@django-js/validation`](packages/validation)       | High-throughput schema validation engine for body, query, and parameter payloads               |
| [`@django-js/cli`](packages/cli)                     | CLI commands (`django-js`, `nexora`), scaffolding, and developer tooling                       |
| [`@django-js/auth`](packages/auth)                   | Authentication (Session, JWT, API Key), Scrypt hashing, and object-level policy engine         |
| [`@django-js/cache`](packages/cache)                 | Driver-agnostic caching with stampede protection (`remember`) and namespaces                   |
| [`@django-js/queue`](packages/queue)                 | At-least-once background job queues, concurrent worker polling, and dead-letter store          |
| [`@django-js/events`](packages/events)               | Typed event definitions, tri-mode execution (`sync`, `async`, `queued`), and priority handlers |
| [`@django-js/websocket`](packages/websocket)         | Multi-room WebSocket management with heartbeat monitoring and backpressure safeguards          |
| [`@django-js/admin-core`](packages/admin-core)       | Declarative admin resource definitions, auto-generation from ORM metadata, and registry        |
| [`@django-js/admin-server`](packages/admin-server)   | Admin REST API server orchestrating CRUD operations, permissions, and audit logging            |
| [`@django-js/admin-auth`](packages/admin-auth)       | Staff authorization, resource-level CRUD permissions, and field-level visibility checks        |
| [`@django-js/admin-audit`](packages/admin-audit)     | Immutable audit trails, change diff calculation, and sensitive field redaction                 |
| [`@django-js/admin-media`](packages/admin-media)     | Secure media uploads, MIME/extension validation, and storage abstractions                      |
| [`@django-js/openapi`](packages/openapi)             | Deterministic OpenAPI 3.1 document generation from router, validation, ORM, and Admin          |
| [`@django-js/observability`](packages/observability) | Structured JSON logging, Prometheus metrics, monotonic tracing, and health checks              |
| [`@django-js/testing`](packages/testing)             | Testing utilities, HTTP client simulator, and mock transports                                  |

---

## Development & Testing

```bash
# Install dependencies
pnpm install

# Build all packages with Turborepo
pnpm build

# Run strict TypeScript typechecking
pnpm typecheck

# Run unit, integration, and E2E test suites with Vitest
pnpm test

# Run microbenchmarks
pnpm bench

# Verify lint and code formatting
pnpm lint
pnpm format:check
```

---

## Documentation

- [Architecture Overview](docs/architecture/01-overview.md)
- [Performance & Benchmarks](docs/performance/README.md)
- [Release Candidate Report](docs/performance/PHASE-15-REPORT.md)
- [Architectural Decision Records (ADRs)](docs/decisions/)
- [Production Deployment Guide](docs/deployment/README.md)
- [Migration Guide](docs/migration/MIGRATION-GUIDE.md)
- [Known Limitations](docs/LIMITATIONS.md)
- [Release Checklist](docs/release/RELEASE-CHECKLIST.md)
- [Security Policy](SECURITY.md)
- [Roadmap](ROADMAP.md)
- [Project Status](PROJECT_STATUS.md)

---

## License

MIT © 2026 django-js contributors.
