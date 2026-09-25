# @jsango/openapi

> Deterministic, zero-reflection OpenAPI 3.1.0 document generator and schema adapters for router, validation, ORM, and Admin.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/openapi
```

## Usage

```typescript
import { OpenApiRegistry, OpenApiFormatter } from '@jsango/openapi';

const registry = new OpenApiRegistry({ title: 'My API', version: '1.0.0' });
const spec = registry.generateDocument();
const json = OpenApiFormatter.toJson(spec);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
