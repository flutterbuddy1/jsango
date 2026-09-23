# 08 — HTTP Server Abstraction & Lifecycle

## Overview

The `IHttpServer` interface defines the contract for listening, processing requests, and cleanly terminating HTTP servers. It remains completely decoupled from route matching or controller logic.

---

## Contract

```typescript
export interface ServerAddress {
  readonly port: number;
  readonly host: string;
  readonly family: string;
}

export type HttpServerHandler = (ctx: RequestContext) => Promise<HttpResponse> | HttpResponse;

export interface IHttpServer {
  readonly isListening: boolean;
  readonly address: ServerAddress | null;
  listen(port?: number, host?: string): Promise<ServerAddress>;
  close(timeoutMs?: number): Promise<void>;
}
```

---

## Graceful Shutdown Protocol

1. **Stop Accepting Inbound Traffic**: `close()` calls the underlying server stop routine immediately.
2. **In-Flight Draining**: Active requests are tracked. Connections are allowed to complete naturally within `timeoutMs` (default: 5000ms).
3. **Hard Termination**: When `timeoutMs` expires, active `AbortController` signals trigger, sockets are closed, and resources are released.
