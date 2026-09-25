# ADR-002: Modular Monorepo & Package Separation

## Status

Accepted

## Context

A monolithic single-package architecture tends to accumulate hidden coupling between database operations, HTTP transports, and routing logic over time. Frameworks that lack strict architectural boundaries often leak transport concerns into ORMs or allow domain models to couple directly to HTTP request formats.

## Decision

We structure `jsango` as a modular monorepo managed with `pnpm workspaces` and `Turborepo`.

- The framework is partitioned into single-responsibility packages (`@jsango/runtime`, `@jsango/core`, `@jsango/container`, `@jsango/config`, `@jsango/http`, `@jsango/router`, `@jsango/middleware`, `@jsango/database`, `@jsango/orm`, `@jsango/validation`, `@jsango/cli`, `@jsango/testing`).
- A strict layered dependency hierarchy is enforced: lower-level packages must never import higher-level packages.
- Zero circular dependencies are allowed.
- Build orchestration uses TypeScript Project References (`tsc -b`) managed via Turborepo pipelines.

## Alternatives Considered

1. **Single Monolithic Package**: Implement all modules within a single codebase under `src/`. Rejected because compiler barriers cannot prevent accidental circular dependencies or layer leaks as effectively as separate packages.
2. **Individual Repositories (Multi-repo)**: Separate repos per package. Rejected due to enormous version management overhead, coordinated release complexity, and high developer friction.

## Consequences

- **Positive**: Strict compile-time boundary enforcement; reusable standalone packages; clear single responsibilities; topological build parallelization.
- **Negative**: Requires monorepo orchestration tools (`pnpm`, `turbo`) and strict cross-package workspace dependency specifications.
