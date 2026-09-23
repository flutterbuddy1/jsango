import { HttpResponse, HttpStatus, type RequestContext } from '@django-js/http';

export class ResponseNormalizer {
  public static normalize(value: unknown, ctx: RequestContext): HttpResponse {
    // 1. Already an HttpResponse
    if (value instanceof HttpResponse) {
      return value;
    }

    // 2. String
    if (typeof value === 'string') {
      return HttpResponse.text(value);
    }

    // 3. Uint8Array (binary)
    if (value instanceof Uint8Array) {
      return new HttpResponse(value, {
        headers: { 'content-type': 'application/octet-stream' },
      });
    }

    // 4. Stream (ReadableStream or AsyncIterable)
    if (
      value !== null &&
      typeof value === 'object' &&
      (value instanceof ReadableStream || Symbol.asyncIterator in value)
    ) {
      return HttpResponse.stream(value as ReadableStream<Uint8Array> | AsyncIterable<Uint8Array>);
    }

    // 5. JSON-serializable primitives and objects
    if (
      (typeof value === 'object' && value !== null) ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      return HttpResponse.json(value);
    }

    // 6. null or undefined (void)
    if (value === null || typeof value === 'undefined') {
      // If handler configured ctx.response directly (e.g. status, headers, or body set)
      if (
        ctx.response.body !== null ||
        ctx.response.statusCode !== HttpStatus.OK ||
        Object.keys(ctx.response.headers.toRecord()).length > 0
      ) {
        return ctx.response;
      }
      return HttpResponse.empty(HttpStatus.NO_CONTENT);
    }

    // Default fallback
    return HttpResponse.text(String(value));
  }
}
