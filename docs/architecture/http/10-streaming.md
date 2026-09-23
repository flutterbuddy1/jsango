# 10 — Streaming Response Architecture

## Design Principles

`HttpResponse` natively supports streaming payloads without buffering the entire dataset in memory:

1. **`ReadableStream<Uint8Array>`**: Standard Web Streams API for browser/edge-compatible streaming.
2. **`AsyncIterable<Uint8Array>`**: Idiomatic asynchronous generators yielding chunks over time.

---

## Example Usage

```typescript
async function* generateStream(): AsyncIterable<Uint8Array> {
  const encoder = new TextEncoder();
  yield encoder.encode('Chunk 1\n');
  await new Promise((r) => setTimeout(r, 100));
  yield encoder.encode('Chunk 2\n');
}

const response = HttpResponse.stream(generateStream(), {
  headers: { 'Content-Type': 'text/event-stream' },
});
```

---

## Backpressure & Memory Efficiency

The adapter writes chunks sequentially to `res.write()`, ensuring that large files or Server-Sent Events (SSE) do not cause unbounded memory allocations.
