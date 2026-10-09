import { describe, it, expect } from 'vitest';
import * as net from 'node:net';
import { createNodeHttpServer } from './index.js';
import { HttpResponse } from './public/response.js';

/** Sends a raw HTTP/1.1 request and resolves with the response text (or '' if closed early). */
function raw(port: number, request: string, timeoutMs = 2000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => socket.write(request));
    let data = '';
    socket.on('data', (d) => (data += d.toString()));
    socket.on('close', () => resolve(data));
    socket.on('error', () => resolve(data));
    socket.setTimeout(timeoutMs, () => {
      socket.destroy();
      reject(new Error(`no response within ${timeoutMs}ms: ${JSON.stringify(data)}`));
    });
  });
}

async function serve(
  handler: Parameters<typeof createNodeHttpServer>[0],
  options?: Parameters<typeof createNodeHttpServer>[1]
) {
  const server = createNodeHttpServer(handler, options);
  const { port } = await server.listen(0, '127.0.0.1');
  return { port, close: () => server.close() };
}

const echo = async (ctx: { request: { pathname: string; ip?: string; protocol?: string } }) =>
  HttpResponse.json({
    path: ctx.request.pathname,
    ip: ctx.request.ip,
    protocol: ctx.request.protocol,
  });

describe('NodeHttpServer hardening', () => {
  it('never lets the Host header change the routed path', async () => {
    const { port, close } = await serve(echo);
    try {
      const res = await raw(
        port,
        'GET /public HTTP/1.1\r\nHost: x/admin/secret?\r\nConnection: close\r\n\r\n'
      );
      expect(res).toContain('"path":"/public"');
    } finally {
      await close();
    }
  });

  it('answers malformed hosts instead of hanging', async () => {
    const { port, close } = await serve(echo);
    try {
      const res = await raw(port, 'GET / HTTP/1.1\r\nHost: a b\r\nConnection: close\r\n\r\n');
      expect(res).toMatch(/^HTTP\/1\.1 (200|400)/);
    } finally {
      await close();
    }
  });

  it('ignores X-Forwarded-* unless trustProxy is set', async () => {
    const req =
      'GET / HTTP/1.1\r\nHost: a\r\nX-Forwarded-For: 6.6.6.6, 1.2.3.4\r\nX-Forwarded-Proto: https\r\nConnection: close\r\n\r\n';
    const direct = await serve(echo);
    const proxied = await serve(echo, { trustProxy: true });
    try {
      expect(await raw(direct.port, req)).toContain('"protocol":"http"');
      expect(await raw(direct.port, req)).not.toContain('1.2.3.4');
      const res = await raw(proxied.port, req);
      expect(res).toContain('"ip":"1.2.3.4"'); // the entry the trusted proxy added, not the forged one
      expect(res).toContain('"protocol":"https"');
    } finally {
      await direct.close();
      await proxied.close();
    }
  });

  it('closes the connection when a streamed body fails midway', async () => {
    const { port, close } = await serve(
      async () =>
        new HttpResponse(
          (async function* () {
            yield new TextEncoder().encode('partial');
            throw new Error('stream broke');
          })()
        )
    );
    try {
      // Resolves (connection closed) instead of timing out; the body is incomplete by design.
      const res = await raw(port, 'GET / HTTP/1.1\r\nHost: a\r\nConnection: close\r\n\r\n');
      expect(res).not.toContain('0\r\n\r\n'); // no clean end of the chunked body
    } finally {
      await close();
    }
  });

  it('keeps ctx.signal alive while a POST handler runs', async () => {
    const { port, close } = await serve(async (ctx) => {
      await (ctx.request as { json(): Promise<unknown> }).json();
      await new Promise((r) => setTimeout(r, 20));
      return HttpResponse.json({ aborted: ctx.signal?.aborted ?? null });
    });
    try {
      const res = await raw(
        port,
        'POST / HTTP/1.1\r\nHost: a\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}'
      );
      expect(res).toContain('"aborted":false');
    } finally {
      await close();
    }
  });
});
