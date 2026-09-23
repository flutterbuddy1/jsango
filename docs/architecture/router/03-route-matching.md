# Route Matching & Resolution

## Result Types

`router.match(method, pathname)` searches the compiled Radix Trie and returns a discriminated union `RouteMatchResult`:

```typescript
export type RouteMatchResult = RouteMatch | MethodNotAllowedMatch | NotFoundMatch;
```

### 1. RouteMatch (`type === 'MATCHED'`)

Returned when an exact route match (or automatic RFC 7231 HEAD fallback) is found:

- `route`: The matched `Route` object.
- `handler`: The route handler function.
- `params`: Readonly dictionary of extracted path parameters.
- `metadata`: Frozen metadata associated with the route and parent groups.
- `isHeadFallback?: boolean`: Present and true if a HEAD request matched a GET handler.

### 2. MethodNotAllowedMatch (`type === 'METHOD_NOT_ALLOWED'`)

Returned when the path exists in the route tree, but no handler exists for the requested HTTP method:

- `allowedMethods`: Readonly array of allowed HTTP methods for this path (including `HEAD` if `GET` is supported).
- `pathname`: Normalized request pathname.

### 3. NotFoundMatch (`type === 'NOT_FOUND'`)

Returned when the path does not exist in the routing tree:

- `pathname`: Normalized request pathname.

## Execution Dispatch via `router.handle(ctx)`

`router.handle(ctx)` coordinates the matching process with HTTP request handling:

1. Normalizes the request pathname and matches against the tree.
2. Injects extracted parameters into `ctx.request.params`.
3. Invokes the matched handler and returns the `HttpResponse`.
4. If `match.isHeadFallback` is true, discards the response body as mandated by RFC 7231.
5. If method is not allowed, returns `405 Method Not Allowed` with the `Allow` header set.
6. If path is not found, returns `404 Not Found`.
