# 09 — Runtime Adapter Boundary

## Node.js Adapter (`NodeHttpServer`)

The `NodeHttpServer` adapter converts between Node's raw transport layer and `django-js` abstractions.

### Inbound Translation

```
node:http.IncomingMessage ──▶ HttpRequest
  - Method (GET, POST, etc.)
  - URL (constructed from protocol, host, and req.url)
  - Headers (normalized to HttpHeaders)
  - Body (wrapped as AsyncIterable<Uint8Array>)
  - Socket abort detection (wired to AbortSignal)
```

### Outbound Translation

```
HttpResponse ──▶ node:http.ServerResponse
  - Sets HTTP status and statusText
  - Sets headers (with multi-value and Set-Cookie handling)
  - Streams or sends buffer/string payload
  - Marks response committed and completed
```

Node-specific classes (`IncomingMessage`, `ServerResponse`) are completely sealed inside `src/internal/node/` and never leak to handlers.
