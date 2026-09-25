# @django-js/http

> Runtime-independent HTTP request/response abstractions, streaming body parsers, cookie security, and RequestContext.

Part of the **[django-js](https://github.com/django-js/django-js)** backend framework for TypeScript.

## Installation

```bash
pnpm add @django-js/http
```

## Usage

```typescript
import { HttpResponse, HttpRequest, RequestContext } from '@django-js/http';

const response = HttpResponse.json({ success: true }, 200);
```

## Documentation

For full architecture documentation and guides, visit the [django-js documentation](https://github.com/django-js/django-js/tree/main/docs).

## License

MIT © django-js contributors
