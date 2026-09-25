# 07 — Testing Strategy

## Testing Layers

Testing in `jsango` is divided into four distinct tiers:

1. **Unit Tests**:
   - Scope: Individual functions, classes, and isolated package abstractions.
   - Colocation: Unit tests reside colocated within `packages/<name>/src/**/*.test.ts`.
   - Tooling: Vitest.
   - Requirements: Fast execution, 100% deterministic, zero network calls, zero external dependencies.

2. **Integration Tests**:
   - Scope: Multi-package contracts (e.g. `router` + `http` + `middleware`, or `orm` + `database`).
   - Location: `tests/integration/`.
   - Requirements: Verify inter-package wiring, lifecycle hooks, and error propagation.

3. **End-to-End Tests**:
   - Scope: Complete application workflows including HTTP servers, live requests, and database transactions.
   - Location: `tests/e2e/`.
   - Requirements: Test realistic scenarios against real runtime adapters.

4. **Benchmarks**:
   - Scope: Hot paths such as route matching, header parsing, serialization, and pipeline execution.
   - Location: `benchmarks/`.
   - Requirements: Run before and after performance-sensitive commits to prevent regressions.

---

## Test Requirements & Determinism

- **No Shared Mutable State**: Tests must instantiate isolated test contexts using `@jsango/testing`.
- **Zero Flakiness**: Timeouts and non-deterministic delays are forbidden; use mock clocks or deterministic event loops.
- **Strict Quality Gate**: No pull request may be merged without passing 100% of unit and integration tests.
