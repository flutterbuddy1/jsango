# @django-js/openapi

> Deterministic, zero-reflection OpenAPI 3.1.0 document generator and schema adapters for router, validation, ORM, and Admin.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/openapi
```

## Usage

```typescript
import { OpenApiRegistry, OpenApiFormatter } from '@django-js/openapi';

const registry = new OpenApiRegistry({ title: 'My API', version: '1.0.0' });
const spec = registry.generateDocument();
const json = OpenApiFormatter.toJson(spec);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
