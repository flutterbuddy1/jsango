# @jsango/http

> Runtime-independent HTTP request/response abstractions, streaming body parsers, cookie security, and RequestContext.

Part of the **[jsango](https://github.com/jsango/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/http
```

## Usage

```typescript
import { HttpResponse, HttpRequest, RequestContext } from '@jsango/http';

const response = HttpResponse.json({ success: true }, 200);
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/jsango/jsango/tree/main/docs).

## License

MIT © jsango contributors
