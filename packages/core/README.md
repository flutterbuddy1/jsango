# @django-js/core

> Application lifecycle coordinator, structured error hierarchy, and foundational abstractions for django-js.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/core
```

## Usage

```typescript
import { DjangoJsError } from '@django-js/core';

throw new DjangoJsError('Invalid state', 'ERR_INVALID_STATE', 400);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
