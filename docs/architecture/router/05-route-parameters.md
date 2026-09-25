# Route Parameters and Constraints

## Parameter Syntax

JSango supports three styles of route parameters:

### 1. Standard Named Parameters

```typescript
router.get('/users/:userId/posts/:postId', handler);
```

Matches `/users/123/posts/456` $\rightarrow$ `{ userId: '123', postId: '456' }`.

### 2. Inline Parameter Constraints

Parameter constraints can be embedded directly within the path string using `<constraint>` syntax:

```typescript
router.get('/users/:id<number>', handler);
router.get('/orders/:id<uuid>', handler);
router.get('/articles/:slug<slug>', handler);
```

### 3. Explicit Route Options Constraints

Constraints can also be specified via `RouteOptions.constraints`:

```typescript
router.get('/files/:filename', handler, {
  constraints: {
    filename: /\.(jpg|png|webp)$/i,
  },
});
```

## Built-In Constraints

JSango provides built-in precompiled regex constraints:

- `number`: `^\d+$` (digits only)
- `uuid`: Standard RFC 4122 UUID pattern
- `slug`: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- `alpha`: `^[a-zA-Z]+$`
- `alphanumeric`: `^[a-zA-Z0-9]+$`

## Custom Functional Constraints

Custom validation logic can be provided as a predicate function:

```typescript
router.get('/years/:year', handler, {
  constraints: {
    year: (val: string) => {
      const year = parseInt(val, 10);
      return !isNaN(year) && year >= 2000 && year <= 2030;
    },
  },
});
```

## Safe Decoding

Parameter values undergo safe URI component decoding (`decodeURIComponent`). If a parameter value contains malformed percent sequences (e.g. `%ZZ`), the router preserves the raw segment without throwing an uncaught URIError.
