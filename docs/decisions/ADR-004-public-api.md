# ADR-004: Public API Boundaries & Encapsulation

## Status

Accepted

## Context

When package entrypoints rely on wildcard exports (`export * from './internal'`), internal implementation classes and helper methods unintentionally become part of the public API. As consumers begin relying on these undocumented internals, subsequent refactorings inadvertently cause breaking changes.

## Decision

Every package in `jsango` must enforce a strict separation between public contracts and internal implementation:

- Source code is organized into `src/public/` (public contracts, interfaces, and public types) and `src/internal/` (internal classes and algorithms).
- The package entrypoint `src/index.ts` must use explicit named re-exports only. Blind wildcard exports are prohibited.
- `package.json` specifies strict export maps (`"exports": { ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" } }`) preventing consumers from deep-importing internal modules.

## Alternatives Considered

1. **Unrestricted Flat Exports**: Keep all files in `src/` and export everything via `export * from './...'`. Rejected because it leaks implementation details and destroys public API predictability.
2. **TypeScript `private` / `internal` JSDoc annotations only**: Rely on documentation tags. Rejected because JavaScript runtime loaders ignore JSDoc comments, allowing illegal imports.

## Consequences

- **Positive**: Clean encapsulation; zero accidental API leakage; freedom to refactor internal algorithms without breaking consumer code; high API stability.
- **Negative**: Requires maintaining explicit export lists in `src/index.ts`.
