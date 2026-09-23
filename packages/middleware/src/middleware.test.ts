import { describe, it, expect, vi } from 'vitest';
import {
  Application,
  MiddlewarePipeline,
  MultipleNextCallsError,
  type IMiddleware,
  type MiddlewareHandler,
  type NextFunction,
} from './index.js';
import { HttpRequest, HttpResponse, HttpStatus, RequestContext } from '@django-js/http';
import { DjangoJsError } from '@django-js/core';

function createMockRequest(
  method: string,
  pathname: string,
  headers: Record<string, string> = {}
): HttpRequest {
  return new HttpRequest({
    method,
    url: `http://localhost:3000${pathname}`,
    headers: { host: 'localhost:3000', ...headers },
  });
}

describe('@django-js/middleware', () => {
  describe('MiddlewarePipeline Engine', () => {
    it('should execute single middleware before and after logic', async () => {
      const order: string[] = [];
      const pipeline = new MiddlewarePipeline();

      const mw: MiddlewareHandler = async (ctx, next) => {
        order.push('mw-before');
        const res = await next();
        order.push('mw-after');
        return res;
      };

      pipeline.use(mw);

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      const res = await pipeline.execute(ctx, async () => {
        order.push('handler');
        return HttpResponse.text('ok');
      });

      expect(order).toEqual(['mw-before', 'handler', 'mw-after']);
      expect(res.statusCode).toBe(200);
    });

    it('should execute multiple middlewares in strict onion order', async () => {
      const order: string[] = [];
      const pipeline = new MiddlewarePipeline();

      pipeline.use(async (_ctx, next) => {
        order.push('mw1-before');
        const res = await next();
        order.push('mw1-after');
        return res;
      });

      pipeline.use(async (_ctx, next) => {
        order.push('mw2-before');
        const res = await next();
        order.push('mw2-after');
        return res;
      });

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      await pipeline.execute(ctx, async () => {
        order.push('terminal');
        return HttpResponse.text('ok');
      });

      expect(order).toEqual(['mw1-before', 'mw2-before', 'terminal', 'mw2-after', 'mw1-after']);
    });

    it('should support class-based middleware implementing IMiddleware', async () => {
      const order: string[] = [];
      class ClassMiddleware implements IMiddleware {
        async handle(_ctx: RequestContext, next: NextFunction): Promise<HttpResponse> {
          order.push('class-before');
          const res = await next();
          order.push('class-after');
          return res;
        }
      }

      const pipeline = new MiddlewarePipeline();
      pipeline.use(new ClassMiddleware());

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      await pipeline.execute(ctx, async () => {
        order.push('handler');
        return HttpResponse.text('ok');
      });

      expect(order).toEqual(['class-before', 'handler', 'class-after']);
    });

    it('should short-circuit and not execute downstream when next() is omitted', async () => {
      const order: string[] = [];
      const pipeline = new MiddlewarePipeline();

      pipeline.use(async () => {
        order.push('mw1');
        return HttpResponse.json({ error: 'unauthorized' }, { status: 401 });
      });

      pipeline.use(async (_ctx, next) => {
        order.push('mw2');
        return next();
      });

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      const res = await pipeline.execute(ctx, async () => {
        order.push('terminal');
        return HttpResponse.text('ok');
      });

      expect(order).toEqual(['mw1']);
      expect(res.statusCode).toBe(401);
      expect(JSON.parse(res.body as string)).toEqual({ error: 'unauthorized' });
    });

    it('should throw MultipleNextCallsError when next() is called twice', async () => {
      const pipeline = new MiddlewarePipeline();

      pipeline.use(async (_ctx, next) => {
        await next();
        await next(); // Illegal second call
        return HttpResponse.text('ok');
      });

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      await expect(
        pipeline.execute(ctx, async () => HttpResponse.text('terminal'))
      ).rejects.toThrow(MultipleNextCallsError);
    });

    it('should allow middleware to catch and transform downstream errors', async () => {
      const pipeline = new MiddlewarePipeline();

      pipeline.use(async (_ctx, next) => {
        try {
          return await next();
        } catch (err) {
          return HttpResponse.json(
            { caught: true, message: (err as Error).message },
            { status: 500 }
          );
        }
      });

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      const res = await pipeline.execute(ctx, async () => {
        throw new Error('Database connection failed');
      });

      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body as string)).toEqual({
        caught: true,
        message: 'Database connection failed',
      });
    });

    it('should guarantee execution of finally blocks in middleware', async () => {
      const finallyRan = vi.fn();
      const pipeline = new MiddlewarePipeline();

      pipeline.use(async (_ctx, next) => {
        try {
          return await next();
        } finally {
          finallyRan();
        }
      });

      const ctx = new RequestContext({ request: createMockRequest('GET', '/') });
      await expect(
        pipeline.execute(ctx, async () => {
          throw new Error('Crash');
        })
      ).rejects.toThrow('Crash');

      expect(finallyRan).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Normalization', () => {
    it('should normalize string returns to HttpResponse.text', async () => {
      const app = new Application();
      app.get('/hello', () => 'Hello World');

      const res = await app.handle(createMockRequest('GET', '/hello'));
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('Hello World');
      expect(res.headers.get('content-type')).toContain('text/plain');
    });

    it('should normalize object and array returns to HttpResponse.json', async () => {
      const app = new Application();
      app.get('/json', () => ({ success: true, items: [1, 2, 3] }));

      const res = await app.handle(createMockRequest('GET', '/json'));
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body as string)).toEqual({ success: true, items: [1, 2, 3] });
      expect(res.headers.get('content-type')).toContain('application/json');
    });

    it('should normalize Uint8Array returns to octet-stream response', async () => {
      const app = new Application();
      const bytes = new Uint8Array([1, 2, 3, 4]);
      app.get('/binary', () => bytes);

      const res = await app.handle(createMockRequest('GET', '/binary'));
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe(bytes);
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
    });

    it('should normalize void/null returns to 204 No Content', async () => {
      const app = new Application();
      app.get('/empty', () => {});

      const res = await app.handle(createMockRequest('GET', '/empty'));
      expect(res.statusCode).toBe(204);
      expect(res.body).toBeNull();
    });

    it('should preserve custom response status and headers when returning void', async () => {
      const app = new Application();
      app.get('/custom-void', (ctx) => {
        ctx.response.statusCode = HttpStatus.ACCEPTED;
        ctx.response.headers.set('X-Custom', 'value');
      });

      const res = await app.handle(createMockRequest('GET', '/custom-void'));
      expect(res.statusCode).toBe(202);
      expect(res.headers.get('x-custom')).toBe('value');
    });
  });

  describe('Route and Group Middleware Integration', () => {
    it('should execute route-level middleware only on matched routes', async () => {
      const order: string[] = [];
      const app = new Application();

      const routeMw: MiddlewareHandler = async (_ctx, next) => {
        order.push('route-mw');
        return next();
      };

      app.get('/guarded', () => 'secret', {
        middleware: [routeMw],
      });

      const res = await app.handle(createMockRequest('GET', '/guarded'));
      expect(order).toEqual(['route-mw']);
      expect(res.statusCode).toBe(200);
      expect(res.body).toBe('secret');
    });

    it('should inherit and execute group middleware before route middleware', async () => {
      const order: string[] = [];
      const app = new Application();

      const groupMw: MiddlewareHandler = async (_ctx, next) => {
        order.push('group-mw');
        return next();
      };

      const routeMw: MiddlewareHandler = async (_ctx, next) => {
        order.push('route-mw');
        return next();
      };

      app.group({ prefix: '/api', middleware: [groupMw] }, (api) => {
        api.get('/items', () => 'items', {
          middleware: [routeMw],
        });
      });

      await app.handle(createMockRequest('GET', '/api/items'));
      expect(order).toEqual(['group-mw', 'route-mw']);
    });

    it('should run global middleware on 404, but NOT route middleware', async () => {
      const order: string[] = [];
      const app = new Application();

      app.use(async (_ctx, next) => {
        order.push('global-before');
        const res = await next();
        order.push('global-after');
        return res;
      });

      app.get('/items', () => 'ok', {
        middleware: [
          async (_ctx, next) => {
            order.push('route-mw');
            return next();
          },
        ],
      });

      const res = await app.handle(createMockRequest('GET', '/unknown-route'));
      expect(res.statusCode).toBe(404);
      expect(order).toEqual(['global-before', 'global-after']);
    });

    it('should run global middleware on 405 with Allow header, but NOT route middleware', async () => {
      const order: string[] = [];
      const app = new Application();

      app.use(async (_ctx, next) => {
        order.push('global-before');
        const res = await next();
        order.push('global-after');
        return res;
      });

      app.post('/submit', () => 'saved', {
        middleware: [
          async (_ctx, next) => {
            order.push('route-mw');
            return next();
          },
        ],
      });

      // Send GET to POST-only route
      const res = await app.handle(createMockRequest('GET', '/submit'));
      expect(res.statusCode).toBe(405);
      expect(res.headers.get('allow')).toBe('POST');
      expect(order).toEqual(['global-before', 'global-after']);
    });
  });

  describe('Named Middleware Registry', () => {
    it('should resolve named middleware in routes', async () => {
      const app = new Application();
      const tracker = vi.fn();

      app.registerMiddleware('auth', async (_ctx, next) => {
        tracker();
        return next();
      });

      app.get('/protected', () => 'protected-data', {
        middleware: ['auth'],
      });

      const res = await app.handle(createMockRequest('GET', '/protected'));
      expect(res.statusCode).toBe(200);
      expect(tracker).toHaveBeenCalledTimes(1);
    });

    it('should throw NamedMiddlewareNotFoundError when referencing missing named middleware', async () => {
      const app = new Application();
      app.get('/bad', () => 'bad', {
        middleware: ['nonexistent'],
      });

      const res = await app.handle(createMockRequest('GET', '/bad'));
      expect(res.statusCode).toBe(500);
      const data = JSON.parse(res.body as string);
      expect(data.error.code).toBe('ERR_NAMED_MIDDLEWARE_NOT_FOUND');
    });
  });

  describe('Request-Scoped Container Isolation and Cleanup', () => {
    it('should create an isolated scope per request and dispose it in finally', async () => {
      const app = new Application();
      const scopeDisposeSpy = vi.fn();

      app.container.registerScoped('perRequestToken', (c) => {
        const token = { id: Math.random() };
        (c as { onDispose?: (cb: () => void) => void }).onDispose?.(scopeDisposeSpy);
        return token;
      });

      app.get('/test-scope', (ctx) => {
        const token = ctx.container?.resolve<{ id: number }>('perRequestToken');
        return { tokenId: token?.id };
      });

      const res1 = await app.handle(createMockRequest('GET', '/test-scope'));
      const res2 = await app.handle(createMockRequest('GET', '/test-scope'));

      const data1 = JSON.parse(res1.body as string);
      const data2 = JSON.parse(res2.body as string);

      expect(data1.tokenId).toBeDefined();
      expect(data2.tokenId).toBeDefined();
      expect(data1.tokenId).not.toBe(data2.tokenId);

      // Disposal must have run for both requests
      expect(scopeDisposeSpy).toHaveBeenCalledTimes(2);
    });

    it('should dispose request scope even if handler throws', async () => {
      const app = new Application();
      const cleanupSpy = vi.fn();

      app.container.registerScoped('service', (c) => {
        (c as { onDispose?: (cb: () => void) => void }).onDispose?.(cleanupSpy);
        return { name: 'failing' };
      });

      app.get('/fail', (ctx) => {
        ctx.container?.resolve('service');
        throw new Error('Handler crash');
      });

      const res = await app.handle(createMockRequest('GET', '/fail'));
      expect(res.statusCode).toBe(500);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling Pipeline', () => {
    it('should mask 5xx internal error details in production mode', async () => {
      const app = new Application({ isProduction: true });
      app.get('/db-error', () => {
        throw new DjangoJsError({
          code: 'ERR_DB',
          message: 'Sensitive database credentials leaked',
          statusCode: 500,
        });
      });

      const res = await app.handle(createMockRequest('GET', '/db-error'));
      expect(res.statusCode).toBe(500);
      const data = JSON.parse(res.body as string);
      expect(data.error.code).toBe('ERR_DB');
      expect(data.error.message).toBe('An internal error occurred.');
    });

    it('should support custom application-level error handlers', async () => {
      const app = new Application();

      app.setErrorHandler((error, _ctx) => {
        return HttpResponse.json(
          { customHandled: true, error: (error as Error).message },
          { status: 503 }
        );
      });

      app.get('/crash', () => {
        throw new Error('Service down');
      });

      const res = await app.handle(createMockRequest('GET', '/crash'));
      expect(res.statusCode).toBe(503);
      expect(JSON.parse(res.body as string)).toEqual({
        customHandled: true,
        error: 'Service down',
      });
    });
  });

  describe('Cancellation and AbortSignal', () => {
    it('should propagate abort signal and trigger cleanup upon client cancellation', async () => {
      const app = new Application();
      const cleanupSpy = vi.fn();

      app.container.registerScoped('heavyTask', (c) => {
        (c as { onDispose?: (cb: () => void) => void }).onDispose?.(cleanupSpy);
        return {};
      });

      const abortController = new AbortController();

      app.get('/cancelable', (ctx) => {
        ctx.container?.resolve('heavyTask');
        // Simulate checking cancellation
        if (ctx.signal.aborted) {
          return HttpResponse.text('Aborted', { status: 499 });
        }
        return 'Done';
      });

      // Abort before request execution
      abortController.abort();

      const req = new HttpRequest({
        method: 'GET',
        url: 'http://localhost:3000/cancelable',
        headers: { host: 'localhost:3000' },
        signal: abortController.signal,
      });

      const res = await app.handle(req);
      expect(res.statusCode).toBe(499);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Concurrency & State Isolation', () => {
    it('should keep request state and context isolated under concurrent load', async () => {
      const app = new Application();

      app.use(async (ctx, next) => {
        const id = ctx.request.headers.get('x-req-id');
        ctx.state.set('id', id);
        return next();
      });

      app.get('/echo-id', (ctx) => {
        return { id: ctx.state.get('id') };
      });

      const tasks = Array.from({ length: 50 }, async (_, i) => {
        const req = createMockRequest('GET', '/echo-id', { 'x-req-id': `req-${i}` });
        const res = await app.handle(req);
        const data = JSON.parse(res.body as string);
        expect(data.id).toBe(`req-${i}`);
      });

      await Promise.all(tasks);
    });
  });
});
