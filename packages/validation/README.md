# @jsango/validation

> High-throughput schema validation engine for request payloads, query parameters, and URL params.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/validation
```

## Usage

```typescript
import { schema, string, number, validate } from '@jsango/validation';
import { Application } from '@jsango/middleware';

const UserSchema = schema({
  email: string().email(),
  age: number().int().min(18),
  nickname: string().max(32).optional(),
});

const result = UserSchema.validate({ email: 'ada@example.com', age: 36 });
if (result.success) {
  console.log(result.data.email);
} else {
  console.log(result.errors); // [{ field, message, code }]
}

// As route middleware: responds 400 with field errors when the body/query/params are invalid.
const app = new Application();
app.post('/users', (ctx) => ({ created: ctx.state.get('validatedBody') }), {
  middleware: [validate({ body: UserSchema, query: { page: number().optional() } })],
});
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
