# django-js

> Production-grade, batteries-included TypeScript backend framework designed for modern JavaScript runtimes and high-concurrency workloads.

---

## Overview

**django-js** combines the convention-over-configuration philosophy and developer ergonomics of Django with modern TypeScript type safety, modular package architecture, and the blazing performance of contemporary JavaScript runtimes (Node.js and Bun).

### Core Principles

- **TypeScript-First**: Strict type safety throughout (`strict: true`, no `any`).
- **Convention Over Configuration**: Opinionated, secure defaults with extensive configurability.
- **Explicit Over Magical**: Zero monkey-patching or opaque reflection on hot execution paths.
- **Runtime Independent**: Clean runtime abstraction supporting Node.js today and Bun in future phases.
- **High Performance**: Designed from day one for high concurrency, minimal object allocations, and non-blocking I/O.
- **Security by Default**: Built-in protections against injection, path traversal, and secret leakage.

---

## Monorepo Packages

| Package                                        | Version | Responsibility                                                      |
| :--------------------------------------------- | :------ | :------------------------------------------------------------------ |
| [`@django-js/runtime`](packages/runtime)       | `0.0.1` | Runtime abstraction and platform adapters (Node.js, Bun)            |
| [`@django-js/core`](packages/core)             | `0.0.1` | Application lifecycle, structured errors, and logging abstractions  |
| [`@django-js/container`](packages/container)   | `0.0.1` | Dependency injection container and service lifetimes                |
| [`@django-js/config`](packages/config)         | `0.0.1` | Configuration loading, schema validation, and environment isolation |
| [`@django-js/http`](packages/http)             | `0.0.1` | HTTP request and response abstractions                              |
| [`@django-js/router`](packages/router)         | `0.0.1` | Route registration, URL parsing, and route matching                 |
| [`@django-js/middleware`](packages/middleware) | `0.0.1` | Middleware pipeline and onion execution model                       |
| [`@django-js/database`](packages/database)     | `0.0.1` | Database drivers, connections, and transactions                     |
| [`@django-js/orm`](packages/orm)               | `0.0.1` | Models, active query builders, and relationships                    |
| [`@django-js/validation`](packages/validation) | `0.0.1` | Request and schema validation contracts                             |
| [`@django-js/cli`](packages/cli)               | `0.0.1` | CLI commands and code generation utilities                          |
| [`@django-js/testing`](packages/testing)       | `0.0.1` | Framework testing utilities and test doubles                        |

---

## Development & Tooling

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 10.0.0 (or Corepack)

### Commands

```bash
# Install dependencies
pnpm install

# Build all packages with Turborepo
pnpm build

# Run strict TypeScript typecheck
pnpm typecheck

# Run unit tests across packages with Vitest
pnpm test

# Run ESLint
pnpm lint

# Check formatting with Prettier
pnpm format:check

# Format code with Prettier
pnpm format
```

---

## Documentation

- [Architecture Overview](docs/architecture/01-overview.md)
- [Package Architecture](docs/architecture/02-package-architecture.md)
- [Dependency Graph](docs/architecture/03-dependency-graph.md)
- [Runtime Independence](docs/architecture/04-runtime.md)
- [Public API Strategy](docs/architecture/05-public-api.md)
- [Error Handling](docs/architecture/06-error-handling.md)
- [Testing Strategy](docs/architecture/07-testing.md)
- [Performance Rules](docs/architecture/08-performance.md)
- [Architectural Decision Records (ADRs)](docs/decisions/)
- [Roadmap](ROADMAP.md)
- [Project Status](PROJECT_STATUS.md)
- [Contributing Guide](CONTRIBUTING.md)
