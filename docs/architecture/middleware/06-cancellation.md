# Request Cancellation & Client Disconnect

## AbortSignal Integration

JSango natively supports request cancellation using standard Web `AbortSignal`:

1. **Client Disconnect**:
   When the client closes the TCP connection before the response finishes, the underlying `NodeHttpServer` triggers an abort on the request's `AbortController`.
2. **Signal Observation**:
   Middleware and handlers can inspect `ctx.signal.aborted` or attach event listeners to cancel expensive background I/O operations or database transactions:
   ```typescript
   if (ctx.signal.aborted) {
     return HttpResponse.text('Client closed connection', { status: 499 });
   }
   ```
3. **Guaranteed Scope Disposal**:
   Client disconnection immediately cancels ongoing tasks and guarantees that the request-scoped container `dispose()` lifecycle runs without leaving hanging promises, sockets, or open transactions.
