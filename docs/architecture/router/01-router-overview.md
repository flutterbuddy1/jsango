# Router Architecture Overview

## Identity and Responsibilities

`@django-js/router` is the high-performance HTTP routing engine of Nexora. It is responsible for mapping incoming HTTP requests to route handlers based on HTTP method, path patterns, parameter constraints, and route priorities.

## Key Capabilities

1. **Radix Trie Data Structure**:
   Hierarchical segment-based tree offering $O(k)$ lookup time, where $k$ is the number of path segments, completely independent of the total number of registered routes.
2. **Deterministic Route Precedence**:
   Routes resolve strictly according to specificity:
   $$\text{Static} > \text{Constrained Param} > \text{Generic Param} > \text{Wildcard}$$
   Registration order never alters precedence across different types of segments.
3. **Parameter Constraints**:
   First-class support for typed path constraints (e.g. `:id<number>`, `:id<uuid>`, `:slug<slug>`, custom regex, and custom validation functions).
4. **Optional Path Parameters**:
   Trailing parameter segments can be declared optional (`/path/:id?`), automatically registering both branches.
5. **Wildcard Segments**:
   Terminal catch-all segments (`*path` or `*`) capture multi-segment remainders.
6. **RFC 7231 Compliance**:
   Automatic HEAD fallback to GET handlers when no explicit HEAD route is registered, discarding the response body upon execution.
7. **Explicit 404 vs 405 Distinctions**:
   Distinguishes between missing paths (404 Not Found) and existing paths requested with an unhandled method (405 Method Not Allowed, returning the standard `Allow` header).
8. **Route Groups & Metadata Inheritance**:
   Hierarchical group scoping for path prefixes and metadata inheritance.
9. **Reverse URL Generation**:
   Named routes with bidirectional URL generation (`router.url('user.detail', { id: 123 })`).
10. **Router Lifecycle & Immutability**:
    Two-phase registration/compilation lifecycle preventing race conditions under high concurrency.
