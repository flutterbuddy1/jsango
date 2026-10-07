# @jsango/core

> Structured error base class, logger and application lifecycle contracts, and foundational abstractions for jsango.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/core
```

## Usage

```typescript
import { JsangoError } from '@jsango/core';

const error = new JsangoError({
  code: 'ERR_INVALID_STATE',
  message: 'Invalid state',
  statusCode: 400,
  metadata: { orderId: 'ord_1' },
});

// Safe for HTTP responses: 5xx messages are masked in production.
console.log(error.toSafeJSON(process.env.NODE_ENV === 'production'));
throw error;
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
