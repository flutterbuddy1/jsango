# 03 — Package Dependency Graph

## Architectural Hierarchy

The package dependency tree enforces strict layering:

```mermaid
graph TD
    runtime["@jsango/runtime"]
    core["@jsango/core"]
    container["@jsango/container"]
    config["@jsango/config"]
    http["@jsango/http"]
    router["@jsango/router"]
    middleware["@jsango/middleware"]
    database["@jsango/database"]
    orm["@jsango/orm"]
    validation["@jsango/validation"]
    cli["@jsango/cli"]
    testing["@jsango/testing"]

    core --> runtime
    container --> core
    config --> core
    config --> runtime
    http --> core
    router --> core
    router --> http
    middleware --> core
    middleware --> http
    database --> core
    orm --> core
    orm --> database
    validation --> core
    cli --> core
    testing --> core
    testing --> container
```

---

## Allowed Dependencies

1. **`@jsango/runtime`**: No internal framework dependencies.
2. **`@jsango/core`**: Depends on `@jsango/runtime`.
3. **`@jsango/container`**: Depends on `@jsango/core`.
4. **`@jsango/config`**: Depends on `@jsango/core`, `@jsango/runtime`.
5. **`@jsango/http`**: Depends on `@jsango/core`.
6. **`@jsango/router`**: Depends on `@jsango/core`, `@jsango/http`.
7. **`@jsango/middleware`**: Depends on `@jsango/core`, `@jsango/http`.
8. **`@jsango/database`**: Depends on `@jsango/core`.
9. **`@jsango/orm`**: Depends on `@jsango/core`, `@jsango/database`.
10. **`@jsango/validation`**: Depends on `@jsango/core`.
11. **`@jsango/cli`**: Depends on `@jsango/core`.
12. **`@jsango/testing`**: Depends on `@jsango/core`, `@jsango/container`.

---

## Strictly Forbidden Dependency Directions

- `core` → `orm` (Domain/data access must not pollute core lifecycle)
- `core` → `router` (Core must remain transport-agnostic)
- `database` → `http` (Persistence layer must never depend on transport)
- `database` → `router` / `controllers`
- `orm` → `router` / `http`
- `runtime` → `application` / any other package
- Any circular dependencies (strictly checked during lint and compilation)
