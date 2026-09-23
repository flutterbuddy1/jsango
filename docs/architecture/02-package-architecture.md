# 02 — Package Architecture

## Package Responsibilities

Each package in the `django-js` monorepo has exactly one clear responsibility:

| Package                 | Responsibility                                                                                    |
| :---------------------- | :------------------------------------------------------------------------------------------------ |
| `@django-js/runtime`    | Runtime abstraction and platform-specific runtime adapters (Node.js, Bun).                        |
| `@django-js/core`       | Application lifecycle, framework primitives, structured error handling, and logging abstractions. |
| `@django-js/container`  | Dependency injection container, service resolution, and lifecycle scoping.                        |
| `@django-js/config`     | Centralized configuration loading, type casting, schema validation, and environment isolation.    |
| `@django-js/http`       | HTTP request/response abstractions, status codes, and header management.                          |
| `@django-js/router`     | Route registration, URL pattern parsing, parameter extraction, and route matching.                |
| `@django-js/middleware` | Middleware pipeline abstractions, onion execution model, and handler chaining.                    |
| `@django-js/database`   | Database connection management, driver contracts, and transaction boundaries.                     |
| `@django-js/orm`        | Model definitions, active query builders, relationships, and entity persistence.                  |
| `@django-js/validation` | Input validation contracts, schema validators, and structured error reporting.                    |
| `@django-js/cli`        | Command-line interface definitions, scaffolding commands, and code generation utilities.          |
| `@django-js/testing`    | Test context creation, isolation helpers, and framework test doubles.                             |

---

## Package Structure Convention

Every package strictly adheres to this internal layout:

```
packages/<name>/
├── package.json        # Manifest with typed exports
├── tsconfig.json       # Project reference extending tsconfig.base.json
└── src/
    ├── index.ts        # Explicit public entrypoint
    ├── public/         # Public interfaces, types, and exported factories
    └── internal/       # Internal implementation details and adapter logic
```

### Encapsulation Rules

- **Zero Blind Wildcard Exports**: `src/index.ts` must explicitly re-export only intended public symbols.
- **Internal Seclusion**: Anything residing in `src/internal/` must not be directly reachable or exported in the package's public API unless passed via an approved factory.
- **NodeNext Resolution**: All import paths in source code include explicit `.js` extensions, ensuring native ECMAScript Modules (ESM) compatibility.
