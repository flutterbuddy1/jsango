import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Application } from './index.js';
import type { IHttpServer } from '@jsango/http';

describe('Application Request Lifecycle Integration Tests', () => {
  let app: Application;
  let server: IHttpServer;
  let baseUrl: string;

  beforeAll(async () => {
    app = new Application({ isProduction: true });

    // 1. Register a request-scoped service
    let requestSequence = 0;
    app.container.registerScoped('requestIdTracker', () => ({
      sequence: ++requestSequence,
    }));

    // 2. Global Middleware (adds custom response header and accesses request-scoped service)
    app.use(async (ctx, next) => {
      const tracker = ctx.container?.resolve<{ sequence: number }>('requestIdTracker');
      const res = await next();
      if (tracker) {
        res.headers.set('x-request-seq', String(tracker.sequence));
      }
      res.headers.set('x-powered-by', 'jsango');
      return res;
    });

    // 3. Register named route middleware
    app.registerMiddleware('auth', async (ctx, next) => {
      const authHeader = ctx.request.headers.get('authorization');
      if (authHeader !== 'Bearer secret-token') {
        return { error: 'Unauthorized' }; // normalizes to 200 JSON or custom response
      }
      return next();
    });

    // 4. Routes
    app.get('/api/health', () => ({ status: 'ok', uptime: 100 }));

    app.get('/api/users/:id<number>', (ctx) => {
      const tracker = ctx.container?.resolve<{ sequence: number }>('requestIdTracker');
      return {
        userId: Number(ctx.request.params['id']),
        seq: tracker?.sequence,
      };
    });

    app.post('/api/echo', async (ctx) => {
      const body = await ctx.request.json<{ message: string }>();
      return { echoed: body.message };
    });

    app.get('/api/secret', () => ({ secret: 'top-secret-data' }), {
      middleware: ['auth'],
    });

    app.get('/api/crash', () => {
      throw new Error('Database connection failed');
    });

    // Start server on ephemeral port
    server = await app.listen(0, '127.0.0.1');
    const addr = server.address;
    baseUrl = `http://127.0.0.1:${addr?.port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  it('should process full HTTP request through global middleware and handler with response normalization', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-powered-by')).toBe('jsango');
    expect(res.headers.get('x-request-seq')).toBeDefined();

    const data = await res.json();
    expect(data).toEqual({ status: 'ok', uptime: 100 });
  });

  it('should isolate request-scoped DI services across concurrent HTTP requests', async () => {
    const [res1, res2] = await Promise.all([
      fetch(`${baseUrl}/api/users/1`),
      fetch(`${baseUrl}/api/users/2`),
    ]);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);

    const seq1 = res1.headers.get('x-request-seq');
    const seq2 = res2.headers.get('x-request-seq');
    expect(seq1).toBeDefined();
    expect(seq2).toBeDefined();
    expect(seq1).not.toBe(seq2);

    const data1 = await res1.json();
    const data2 = await res2.json();
    expect(data1.userId).toBe(1);
    expect(data2.userId).toBe(2);
    expect(data1.seq).toBe(Number(seq1));
    expect(data2.seq).toBe(Number(seq2));
  });

  it('should handle POST requests with JSON payload', async () => {
    const res = await fetch(`${baseUrl}/api/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: 'Hello Phase 4!' }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ echoed: 'Hello Phase 4!' });
  });

  it('should enforce route middleware on protected route', async () => {
    // Missing auth header
    const resForbidden = await fetch(`${baseUrl}/api/secret`);
    expect(resForbidden.status).toBe(200);
    const forbiddenData = await resForbidden.json();
    expect(forbiddenData).toEqual({ error: 'Unauthorized' });

    // With valid auth header
    const resAllowed = await fetch(`${baseUrl}/api/secret`, {
      headers: { authorization: 'Bearer secret-token' },
    });
    expect(resAllowed.status).toBe(200);
    const allowedData = await resAllowed.json();
    expect(allowedData).toEqual({ secret: 'top-secret-data' });
  });

  it('should execute error pipeline and return masked 500 on unhandled error', async () => {
    const res = await fetch(`${baseUrl}/api/crash`);
    expect(res.status).toBe(500);
    expect(res.headers.get('x-powered-by')).toBe('jsango');

    const data = await res.json();
    expect(data.error.code).toBe('ERR_INTERNAL_ERROR');
    expect(data.error.message).toBe('An internal error occurred.');
  });

  it('should return 404 for unknown routes while still applying global middleware', async () => {
    const res = await fetch(`${baseUrl}/nonexistent`);
    expect(res.status).toBe(404);
    expect(res.headers.get('x-powered-by')).toBe('jsango');
    expect(res.headers.get('x-request-seq')).toBeDefined();

    const data = await res.json();
    expect(data.error.code).toBe('ERR_HTTP_NOT_FOUND');
  });

  it('should return 405 with Allow header for method mismatch while applying global middleware', async () => {
    const res = await fetch(`${baseUrl}/api/echo`, { method: 'GET' });
    expect(res.status).toBe(405);
    expect(res.headers.get('allow')).toBe('POST');
    expect(res.headers.get('x-powered-by')).toBe('jsango');

    const data = await res.json();
    expect(data.error.code).toBe('ERR_HTTP_METHOD_NOT_ALLOWED');
  });
});
