# 05 — Public API Strategy

## Public vs. Internal API Boundaries

A major pitfall in framework evolution is the accidental leakage of internal implementation details into the public API, leading to brittle user code and breaking changes during internal refactoring.

`jsango` enforces explicit API segregation:

```
packages/<name>/src/
├── index.ts        # The Single Public Entrypoint
├── public/         # Public contracts, types, factories, and stable abstractions
└── internal/       # Implementation details, adapters, and private utilities
```

---

## Encapsulation Guarantees

1. **Explicit Exports Only**:
   Wildcard exports (`export * from '...'`) from internal modules are strictly forbidden. The root `src/index.ts` must selectively re-export explicitly vetted classes, interfaces, and factory functions.
2. **Export Field Resolution**:
   Each `package.json` specifies modern conditional exports:
   ```json
   "exports": {
     ".": {
       "types": "./dist/index.d.ts",
       "import": "./dist/index.js"
     }
   }
   ```
   Direct deep imports into `package/dist/internal/*` are prevented by the runtime resolver.
3. **Semantic Versioning Integrity**:
   Changes to anything exported from `src/index.ts` are considered public contract changes and must adhere to Semantic Versioning. Internal changes under `src/internal/` do not constitute breaking public changes.
