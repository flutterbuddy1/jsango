import { describe, bench } from 'vitest';
import {
  HttpRequest,
  HttpResponse,
  HttpHeaders,
  HttpQuery,
  RequestContext,
  NotFoundError,
} from '../../packages/http/src/index.js';

describe('HTTP Benchmarks', () => {
  bench('1. Request object creation', () => {
    new HttpRequest({
      method: 'GET',
      url: 'http://localhost:3000/api/v1/users?page=1&limit=20',
      headers: {
        'content-type': 'application/json',
        'x-request-id': 'req-bench-123',
      },
    });
  });

  const headers = new HttpHeaders({
    'Content-Type': 'application/json',
    'User-Agent': 'Benchmark/1.0',
    Authorization: 'Bearer token123',
  });

  bench('2. Header lookup', () => {
    headers.get('content-type');
    headers.get('authorization');
  });

  bench('3. Header mutation (set & delete)', () => {
    const h = new HttpHeaders();
    h.set('X-Custom-Header', 'custom-value');
    h.delete('X-Custom-Header');
  });

  bench('4. Query parameter parsing', () => {
    new HttpQuery('search=vitest&page=2&tags=ts&tags=node&sort=asc');
  });

  const payload = { success: true, id: 12345, items: ['a', 'b', 'c'] };

  bench('5. JSON response creation', () => {
    HttpResponse.json(payload);
  });

  bench('6. Text response creation', () => {
    HttpResponse.text('Hello World from django-js');
  });

  bench('7. Raw Response creation', () => {
    new HttpResponse('plain text', { status: 200 });
  });

  bench('8. HTTP error creation and safe serialization', () => {
    const err = new NotFoundError('Item was not found in catalog');
    err.toSafeJSON(true);
  });

  const baseReq = new HttpRequest({
    method: 'GET',
    url: 'http://localhost:3000/api/test',
  });

  bench('9. Request context creation', () => {
    new RequestContext({ request: baseReq });
  });
});
