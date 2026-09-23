# Middleware Lifecycle & Execution Semantics

## Onion Execution Model

Middleware components in Nexora wrap around subsequent middleware and the route handler in an onion-like stack:

```
Middleware 1 (Before)
   │
   └──> Middleware 2 (Before)
           │
           └──> Route Handler
           │
   ┌─── Middleware 2 (After)
   │
Middleware 1 (After)
```

## Middleware Contracts

Middleware can be defined as an asynchronous function or as a class implementing `IMiddleware`:

```typescript
// Functional Middleware
const loggerMiddleware: MiddlewareHandler = async (ctx, next) => {
  const start = Date.now();
  const response = await next();
  const duration = Date.now() - start;
  ctx.logger.info(
    `${ctx.request.method} ${ctx.request.pathname} - ${response.statusCode} (${duration}ms)`
  );
  return response;
};

// Class-Based Middleware
class AuthMiddleware implements IMiddleware {
  async handle(ctx: RequestContext, next: NextFunction): Promise<HttpResponse> {
    const auth = ctx.request.headers.get('authorization');
    if (!auth) {
      return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return next();
  }
}
```

## `next()` Execution Invariants

1. **Single Invocation**:
   `next()` represents the continuation of the pipeline. It must only be called **once** per middleware invocation.
2. **Double-Call Detection**:
   If a middleware invokes `next()` more than once (sequentially or concurrently via `Promise.all`), `MiddlewarePipeline` detects the violation and throws `MultipleNextCallsError`.
3. **Short-Circuiting**:
   If a middleware returns a value without calling `next()`, downstream execution stops immediately. The returned value is passed to `ResponseNormalizer` and propagated up the stack through upstream after-logic.
4. **Exception Handling**:
   Middleware can wrap `await next()` in `try ... catch` blocks to intercept or transform downstream errors, and `finally` blocks to perform mandatory cleanup.
