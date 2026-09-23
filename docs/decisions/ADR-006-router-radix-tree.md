# ADR-006: Radix Tree Router Architecture and Deterministic Precedence

## Status

Accepted

## Context

High-concurrency backend services require sub-microsecond route resolution. Traditional regex-list routers (such as early Express iterations) suffer from $O(N)$ lookup degradation as route tables expand, and their matching precedence is coupled to linear registration order rather than route specificity. Furthermore, frameworks must handle parameter constraints, optional segments, wildcards, and RFC 7231 method conformance (automatic HEAD fallbacks and 405 Method Not Allowed handling) without compromising performance or architectural cleanliness.

## Decision

1. **Segment-Based Radix Trie Data Structure**:
   Implement route matching using a segment-based Radix Trie (`RadixTree`). Segment children are indexed via direct JavaScript `Map` lookups for static segments, prioritized arrays for parameter segments, and dedicated nodes for trailing wildcards. Lookups achieve $O(k)$ complexity where $k$ is the path depth, maintaining consistent throughput from 10 to 1,000+ routes.

2. **Deterministic Route Precedence**:
   Enforce strict precedence:
   $$\text{Static} > \text{Constrained Parameter} > \text{Generic Parameter} > \text{Wildcard}$$
   Registration order does not affect precedence across segment categories.

3. **Inline and Explicit Parameter Constraints**:
   Support typed parameter constraints both inline (`:id<number>`, `:id<uuid>`, `:slug<slug>`) and via route options. Constraints are precompiled into boolean predicate functions during registration and evaluated per segment.

4. **RFC 7231 Compliance (Automatic HEAD Fallback & 405 Distinctions)**:
   - When a HEAD request has no explicit HEAD handler, it automatically executes the matching GET handler, and `router.handle(ctx)` strips the response body before transmission.
   - If a path matches an existing branch but not the requested HTTP method, the router returns a `METHOD_NOT_ALLOWED` match containing all permitted methods, enabling automated 405 responses with the RFC-mandated `Allow` header.

5. **Two-Phase Router Lifecycle**:
   Routes are registered during startup in the `registering` phase. Invoking `router.compile()` freezes the trie into a `locked` state, preventing dynamic mutation and eliminating race conditions in concurrent execution loops.

## Alternatives Considered

1. **Linear Regex Array (`path-to-regexp`)**:
   Rejected due to $O(N)$ worst-case performance scaling, heavy memory allocations on every request, and fragile registration-order dependencies.
2. **Dynamic JIT Function Compilation (`new Function(...)`)**:
   Rejected because dynamic code generation violates Content Security Policy (CSP), impairs debugging, and introduces potential code injection vulnerabilities. Pure Radix Trie traversal in TypeScript yields comparable throughput (>3.2M ops/s) with full security.

## Consequences

- **Positive**: $O(k)$ lookup performance (~0.3 µs for static routes, ~0.6 µs for parameterized routes); deterministic route precedence; clean separation of 404 and 405 status codes; zero host or runtime dependencies.
- **Negative**: Trie structure requires careful segment-level parameter partitioning for overlapping parameter constraints.
