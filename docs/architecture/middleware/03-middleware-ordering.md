# Middleware Ordering Rules

## Deterministic Execution Hierarchy

JSango executes middleware in an explicit, deterministic order based on registration scope and hierarchy:

```
Global Middleware 1 (Before)
  Global Middleware 2 (Before)
    Group Middleware (Before)
      Route Middleware (Before)
        Route Handler
      Route Middleware (After)
    Group Middleware (After)
  Global Middleware 2 (After)
Global Middleware 1 (After)
```

## Order Rules

1. **Global Middleware**:
   Executes in exact array registration order for all incoming requests before route matching occurs.
2. **Route Groups**:
   When routes are declared within nested `router.group()` blocks, outer group middleware executes before inner group middleware.
3. **Route Middleware**:
   Middleware defined on individual routes (`RouteOptions.middleware`) executes after group middleware and immediately before the route handler.
4. **404 / 405 Behavior**:
   - Global middleware **always** executes, ensuring that CORS headers, request IDs, and telemetry are attached even to error responses.
   - Route and group middleware **never** executes when a route is unmatched (404) or requested with an invalid method (405).
5. **No Implicit Ordering**:
   JSango strictly prohibits non-deterministic ordering based on file system scanning, object property iteration, or module import timing. Middleware arrays are preserved and executed in explicit order.
