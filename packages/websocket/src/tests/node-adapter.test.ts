import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { WebSocket as WSClient } from 'ws';
import { NodeWebSocketAdapter } from '../internal/node-adapter.js';

describe('NodeWebSocketAdapter', () => {
  let server: HttpServer | undefined;
  let adapter: NodeWebSocketAdapter | undefined;

  afterEach(async () => {
    if (adapter) {
      await adapter.close();
      adapter = undefined;
    }
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      server = undefined;
    }
  });

  it('handles upgrade, messages, and broadcasts over actual WebSocket connection', async () => {
    server = createServer();
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };

    adapter = new NodeWebSocketAdapter({
      server,
      path: '/ws',
      allowAnonymous: true,
    });
    await adapter.start();

    adapter.manager.on<{ ping: string }>('client.ping', async (ctx, msg) => {
      await ctx.reply('server.pong', { echo: msg.payload?.ping });
    });

    const client = new WSClient(`ws://127.0.0.1:${address.port}/ws`);

    await new Promise<void>((resolve) => client.on('open', () => resolve()));

    const receivedMessages: any[] = [];
    client.on('message', (data) => {
      receivedMessages.push(JSON.parse(data.toString()));
    });

    client.send(
      JSON.stringify({
        type: 'client.ping',
        payload: { ping: 'hello-from-client' },
        requestId: 'r-1',
      })
    );

    // Wait for reply
    await new Promise<void>((resolve) => {
      const check = setInterval(() => {
        if (receivedMessages.length > 0) {
          clearInterval(check);
          resolve();
        }
      }, 20);
    });

    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0]?.type).toBe('server.pong');
    expect(receivedMessages[0]?.payload.echo).toBe('hello-from-client');
    expect(receivedMessages[0]?.requestId).toBe('r-1');

    client.close();
  });

  it('rejects upgrade when anonymous access is denied and no auth provided', async () => {
    server = createServer();
    await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', () => resolve()));
    const address = server.address() as { port: number };

    adapter = new NodeWebSocketAdapter({
      server,
      path: '/ws',
      allowAnonymous: false,
    });
    await adapter.start();

    const client = new WSClient(`ws://127.0.0.1:${address.port}/ws`);

    const errorPromise = new Promise<Error>((resolve) => {
      client.on('error', (err) => resolve(err));
    });

    const err = await errorPromise;
    expect(err.message).toMatch(/401|Unexpected server response/);
  });

  it('authenticates connections in standalone (port) mode too', async () => {
    adapter = new NodeWebSocketAdapter({ port: 0, host: '127.0.0.1', path: '/ws' });
    await new Promise((r) => setTimeout(r, 20));
    const port = (adapter as unknown as { httpServer: HttpServer }).httpServer.address() as {
      port: number;
    };
    const status = await new Promise<number>((resolve) => {
      const client = new WSClient(`ws://127.0.0.1:${port.port}/ws`);
      client.on('unexpected-response', (_req, res) => resolve(res.statusCode ?? 0));
      client.on('open', () => resolve(101));
    });
    expect(status).toBe(401);
  });
});
