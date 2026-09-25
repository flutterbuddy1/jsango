# @jsango/core

> Application lifecycle coordinator, structured error hierarchy, and foundational abstractions for jsango.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/core
```

## Usage

```typescript
import { JsangoError } from '@jsango/core';

throw new JsangoError('Invalid state', 'ERR_INVALID_STATE', 400);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
