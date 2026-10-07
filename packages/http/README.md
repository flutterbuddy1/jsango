# @jsango/http

> Runtime-independent HTTP request/response abstractions, streaming body parsers, cookie security, and RequestContext.

Part of the **[jsango](https://github.com/flutterbuddy1/jsango)** backend framework for TypeScript.

## Installation

```bash
pnpm add @jsango/http
```

## Usage

```typescript
import { HttpRequest, HttpResponse, HttpStatus, RequestContext } from '@jsango/http';

const request = new HttpRequest({
  method: 'POST',
  url: '/api/users?page=2',
  headers: { 'content-type': 'application/json', cookie: 'session=abc' },
  body: JSON.stringify({ email: 'user@test.com' }),
});
const ctx = new RequestContext({ request });

const page = ctx.request.query.get('page'); // '2'
const session = ctx.request.cookies['session']; // 'abc'
const body = await ctx.request.json<{ email: string }>();

const response = HttpResponse.json({ success: true, email: body.email }, { status: HttpStatus.CREATED });
response.setCookie('seen', '1', { httpOnly: true, sameSite: 'Lax' });
```

## Documentation

For full architecture documentation and guides, visit the [jsango documentation](https://github.com/flutterbuddy1/jsango/tree/main/docs).

## License

MIT © jsango contributors
