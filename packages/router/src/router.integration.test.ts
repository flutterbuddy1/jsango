import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Router } from './index.js';
import { createNodeHttpServer, HttpResponse, type IHttpServer } from '@django-js/http';

describe('Router HTTP Integration Tests', () => {
  let server: IHttpServer;
  let baseUrl: string;
  const router = new Router();

  beforeAll(async () => {
    // 1. Static route
    router.get('/api/health', () => HttpResponse.json({ status: 'healthy' }));

    // 2. Parameterized route
    router.get('/api/users/:id<number>', (ctx) => {
      return HttpResponse.json({ userId: Number(ctx.request.params['id']) });
    });

    // 3. POST route with JSON body
    router.post('/api/echo', async (ctx) => {
      const data = await ctx.request.json<{ message: string }>();
      return HttpResponse.json({ echo: data.message });
    });

    // 4. GET route to test automatic HEAD fallback
    router.get('/api/info', () => HttpResponse.text('info-content'));

    // Lock/compile router
    router.compile();

    // Start server connected to router.handle(ctx)
    server = createNodeHttpServer(async (ctx) => {
      return router.handle(ctx);
    });

    const addr = await server.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  it('should handle real GET static request', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ status: 'healthy' });
  });

  it('should handle real GET parameterized request and extract route params', async () => {
    const res = await fetch(`${baseUrl}/api/users/42`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ userId: 42 });
  });

  it('should handle real POST request with JSON payload', async () => {
    const res = await fetch(`${baseUrl}/api/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello Nexora!' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ echo: 'Hello Nexora!' });
  });

  it('should handle real HEAD request using automatic RFC 7231 GET fallback', async () => {
    const res = await fetch(`${baseUrl}/api/info`, { method: 'HEAD' });
    expect(res.status).toBe(200);
    // HEAD responses must have no body
    const text = await res.text();
    expect(text).toBe('');
  });

  it('should return 404 for unknown path', async () => {
    const res = await fetch(`${baseUrl}/api/unknown-endpoint`);
    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error.code).toBe('ERR_HTTP_NOT_FOUND');
  });

  it('should return 405 with Allow header for method mismatch', async () => {
    const res = await fetch(`${baseUrl}/api/echo`, { method: 'GET' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    const data = await res.json();
    expect(data.error.code).toBe('ERR_HTTP_METHOD_NOT_ALLOWED');
  });
});
