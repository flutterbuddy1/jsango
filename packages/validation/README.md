# @django-js/validation

> High-throughput schema validation engine for request payloads, query parameters, URL params, and headers.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/validation
```

## Usage

```typescript
import { schema, validate } from '@django-js/validation';

const UserSchema = schema.object({
  email: schema.string().email(),
  age: schema.number().min(18),
});

const result = validate(UserSchema, payload);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
