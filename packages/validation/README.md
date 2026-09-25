# @jsango/validation

> High-throughput schema validation engine for request payloads, query parameters, URL params, and headers.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/validation
```

## Usage

```typescript
import { schema, validate } from '@jsango/validation';

const UserSchema = schema.object({
  email: schema.string().email(),
  age: schema.number().min(18),
});

const result = validate(UserSchema, payload);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
