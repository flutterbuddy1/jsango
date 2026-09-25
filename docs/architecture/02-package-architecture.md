# 02 — Package Architecture

## Package Responsibilities

Each package in the `jsango` monorepo has exactly one clear responsibility:

| Package              | Responsibility                                                                                    |
| :------------------- | :------------------------------------------------------------------------------------------------ |
| `@jsango/runtime`    | Runtime abstraction and platform-specific runtime adapters (Node.js, Bun).                        |
| `@jsango/core`       | Application lifecycle, framework primitives, structured error handling, and logging abstractions. |
| `@jsango/container`  | Dependency injection container, service resolution, and lifecycle scoping.                        |
| `@jsango/config`     | Centralized configuration loading, type casting, schema validation, and environment isolation.    |
| `@jsango/http`       | HTTP request/response abstractions, status codes, and header management.                          |
| `@jsango/router`     | Route registration, URL pattern parsing, parameter extraction, and route matching.                |
| `@jsango/middleware` | Middleware pipeline abstractions, onion execution model, and handler chaining.                    |
| `@jsango/database`   | Database connection management, driver contracts, and transaction boundaries.                     |
| `@jsango/orm`        | Model definitions, active query builders, relationships, and entity persistence.                  |
| `@jsango/validation` | Input validation contracts, schema validators, and structured error reporting.                    |
| `@jsango/cli`        | Command-line interface definitions, scaffolding commands, and code generation utilities.          |
| `@jsango/testing`    | Test context creation, isolation helpers, and framework test doubles.                             |

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
