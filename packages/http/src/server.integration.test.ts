import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { createNodeHttpServer, type IHttpServer } from './index.js';
import { HttpResponse } from './public/response.js';
import { NotFoundError } from './public/errors.js';

describe('NodeHttpServer Integration Tests', () => {
  let server: IHttpServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = createNodeHttpServer(async (ctx) => {
      const pathname = ctx.request.pathname;

      if (pathname === '/hello') {
        const res = HttpResponse.json({ message: 'Hello from jsango!' });
        res.setCookie('auth_session', 'sess_123', { httpOnly: true });
        return res;
      }

      if (pathname === '/echo' && ctx.request.method === 'POST') {
        const body = await ctx.request.json<{ text: string }>();
        return HttpResponse.json({ echoed: body.text });
      }

      if (pathname === '/error') {
        throw new NotFoundError('Item not found');
      }

      return HttpResponse.text('Not Found', { status: 404 });
    });

    // Listen on ephemeral port (0)
    const addr = await server.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await server.close();
  });

  it('should process GET request, return JSON and set cookies', async () => {
    const res = await fetch(`${baseUrl}/hello`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');

    const cookieHeader = res.headers.get('set-cookie');
    expect(cookieHeader).toContain('auth_session=sess_123');

    const json = (await res.json()) as { message: string };
    expect(json.message).toBe('Hello from jsango!');
  });

  it('should process POST request with JSON body', async () => {
    const res = await fetch(`${baseUrl}/echo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Vitest Live Request' }),
    });

    expect(res.status).toBe(200);
    const json = (await res.json()) as { echoed: string };
    expect(json.echoed).toBe('Vitest Live Request');
  });

  it('should safely format and serialize HTTP errors', async () => {
    const res = await fetch(`${baseUrl}/error`);
    expect(res.status).toBe(404);

    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe('ERR_HTTP_NOT_FOUND');
    expect(json.error.message).toBe('Item not found');
  });
});
