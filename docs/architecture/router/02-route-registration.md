# Route Registration

## API Surface

Routes are registered using method-specific convenience functions on the `Router` instance:

```typescript
import { Router } from '@jsango/router';
import { HttpResponse } from '@jsango/http';

const router = new Router();

// HTTP verb registration
router.get('/users', async (ctx) => HttpResponse.json([]));
router.post('/users', async (ctx) => HttpResponse.json({ created: true }, { status: 201 }));
router.put('/users/:id', async (ctx) => HttpResponse.json({ updated: true }));
router.patch('/users/:id', async (ctx) => HttpResponse.json({ patched: true }));
router.delete('/users/:id', async (ctx) => HttpResponse.text('', { status: 204 }));
router.head('/health', async (ctx) => HttpResponse.text(''));
router.options('/auth', async (ctx) => HttpResponse.text(''));

// Generic route registration
router.route('CUSTOM', '/custom-verb', async (ctx) => HttpResponse.text('custom'));
```

## Route Options

Each registration method accepts an optional `RouteOptions` configuration:

```typescript
export interface RouteOptions {
  readonly name?: string | undefined;
  readonly constraints?: Record<string, RouteConstraintDefinition> | undefined;
  readonly metadata?: Record<string, unknown> | undefined;
}
```

- `name`: Unique identifier for reverse URL generation. Throws `DuplicateRouteNameError` if a name is duplicated.
- `constraints`: Dictionary of parameter constraints applied to named path parameters.
- `metadata`: Arbitrary key-value metadata attached to the route, available during route matching and execution.

## Path Normalization

Path strings are automatically normalized upon registration:

- Leading slashes are ensured (`users` becomes `/users`).
- Consecutive slashes are collapsed (`//api///v1/` becomes `/api/v1`).
- Trailing slashes are stripped except for the root `/` path.
