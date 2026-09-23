# 06 — Request Context & Scoped State

## Overview

`RequestContext` is the unified execution context provided to HTTP handlers and downstream middleware. It bundles the incoming `HttpRequest`, outgoing `HttpResponse`, structured `ILogger`, correlation `requestId`, `AbortSignal`, and an optional scoped dependency injection container (`IContainer`).

---

## Structure

```typescript
export class RequestContext {
  public readonly request: HttpRequest;
  public response: HttpResponse;
  public readonly requestId: string;
  public readonly logger: ILogger;
  public readonly container?: IContainer | undefined;
  public readonly signal: AbortSignal;
  public readonly state: Map<string, unknown>;
}
```

---

## Architectural Roles

1. **Correlation Tracking**:
   The `requestId` is initialized from incoming `x-request-id` headers or generated automatically via `crypto.randomUUID()`.
2. **Contextual State Store**:
   `state` allows middleware to attach request-scoped data (e.g., authenticated user, timing markers) without monkey-patching request objects.
3. **Dependency Injection**:
   The `container` field enables request-scoped service resolution once the container package integrates with the HTTP pipeline.
