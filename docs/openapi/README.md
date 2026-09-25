# OpenAPI Documentation

See [`docs/architecture/openapi/README.md`](file:///Users/mayankdiwakar/Documents/Development/jsango/docs/architecture/openapi/README.md) for full architectural details.

## Quick Start

### 1. Annotate Routes with OpenAPI Metadata

```typescript
router.get('/users/:id', getUserHandler, {
  metadata: {
    openapi: {
      operationId: 'getUserById',
      summary: 'Get user details by ID',
      tags: ['Users'],
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      responses: {
        200: {
          description: 'User details',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
    },
  },
});
```

### 2. Generate and Validate Spec via CLI

```bash
# Generate JSON spec to file
jsango openapi:generate --output openapi.json

# Generate YAML spec to stdout
jsango openapi:generate --format yaml

# Validate spec
jsango openapi:validate --file openapi.json
```
