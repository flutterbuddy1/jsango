# 02 — HTTP Request Abstraction

## Overview

The `HttpRequest` class represents an incoming HTTP request in a platform-independent format. It decouples the application from host-specific request types (such as Node.js `IncomingMessage` or Bun native requests).

---

## API Reference

```typescript
export class HttpRequest {
  public readonly method: HttpMethod;
  public readonly url: URL;
  public readonly pathname: string;
  public readonly query: HttpQuery;
  public readonly headers: HttpHeaders;
  public readonly cookies: Readonly<Record<string, string>>;
  public readonly body: HttpBody;
  public readonly ip?: string | undefined;
  public readonly protocol: string;
  public readonly requestId: string;
  public readonly signal: AbortSignal;
  public readonly params: Readonly<Record<string, string>>;

  public get contentType(): string;
  public get contentLength(): number | null;

  public async json<T = unknown>(): Promise<T>;
  public async text(): Promise<string>;
  public async bytes(): Promise<Uint8Array>;
  public async formData(): Promise<Record<string, string | string[]>>;
}
```

---

## Immutability & Lifecycle

- **Read-Only Descriptors**: The HTTP method, URL, headers, and query parameters are immutable after request initialization.
- **Single Consumption**: Body streams can only be read once (`json()`, `text()`, `bytes()`, or `formData()`). Calling a second reader throws `PayloadAlreadyConsumedError`.
- **Cancellation**: `request.signal` is linked to client socket termination. Handlers and database drivers can listen to `abort` events to terminate processing early.
