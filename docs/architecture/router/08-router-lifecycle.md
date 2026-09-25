# Router Lifecycle & Immutability

## State Model

The `Router` operates across an explicit two-phase lifecycle:

```
[ Registering ]  ── router.compile() ──>  [ Locked / Compiled ]
```

### Phase 1: Registration (`registering`)

- The application registers routes, route groups, and constraints.
- Route tables are dynamic and mutable.
- Matching may be performed, but route registration is actively permitted.

### Phase 2: Compilation & Locking (`locked` / `compiled`)

- Triggered by calling `router.compile()`.
- The router tree becomes frozen.
- Any subsequent attempt to register routes or route groups throws a `RouterLockedError`.
- Multiple calls to `compile()` are idempotent and safe.

## Concurrency Protection

By locking the routing table before the HTTP server starts accepting traffic, JSango eliminates all concurrency hazards and race conditions related to route modifications in high-concurrency environments.
