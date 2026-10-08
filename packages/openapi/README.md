# @jsango/openapi

> Deterministic, zero-reflection OpenAPI 3.1.0 document generator and schema adapters for router, validation, ORM, and Admin.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/openapi
```

## Usage

```typescript
import {
  OpenApiGenerator,
  OpenApiRegistry,
  OpenApiFormatter,
  SchemaBuilder,
  createOpenApiHandler,
} from '@jsango/openapi';
import { Router } from '@jsango/router';

const router = new Router();
router.get('/users/:id', (ctx) => ({ id: ctx.request.params.id }), {
  metadata: {
    openapi: {
      summary: 'Get a user',
      tags: ['users'],
      responses: {
        '200': {
          description: 'The user',
          content: { 'application/json': { schema: SchemaBuilder.ref('User') } },
        },
      },
    },
  },
});

const registry = new OpenApiRegistry();
registry.registerSchema(
  'User',
  SchemaBuilder.object({ id: SchemaBuilder.uuid(), email: SchemaBuilder.email() }, ['id', 'email'])
);

const generator = new OpenApiGenerator({ info: { title: 'My API', version: '1.0.0' }, registry });
const spec = generator.generate(router);
const json = OpenApiFormatter.toJson(spec);

// Serve it: router.get('/openapi.json', createOpenApiHandler(generator, { router }));
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
