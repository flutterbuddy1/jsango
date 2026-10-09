import { describe, it, expect, afterEach } from 'vitest';
import * as net from 'node:net';
import { WebSocket } from 'ws';
import { createApp, forbidden, agent, FakeLlmProvider, type RequestContext } from './index.js';

type App = ReturnType<typeof createApp>;
const servers: { close(): Promise<void> }[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

async function start(app: App) {
  const server = await app.listen(0, '127.0.0.1');
  servers.push(server);
  return `ws://127.0.0.1:${server.address!.port}`;
}

/** Opens a client and collects the parsed messages it receives. */
function client(url: string, headers: Record<string, string> = {}) {
  const ws = new WebSocket(url, { headers });
  const received: unknown[] = [];
  ws.on('message', (raw) => received.push(JSON.parse(raw.toString())));
  const opened = new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('unexpected-response', (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    ws.once('error', reject);
  });
  return { ws, received, opened };
}

const until = async (check: () => boolean, ms = 1000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

// Stand-in for auth.required(): the `x-user` header is the signed-in user.
const signedIn = (ctx: RequestContext, next: () => Promise<unknown>) => {
  if (!ctx.request.headers.get('x-user')) throw forbidden('Sign in first');
  return next();
};

describe('app.ws', () => {
  it('dispatches events, rooms (sender excluded) and app.to() server push', async () => {
    const app = createApp();
    app.ws('/chat/:room', {
      open(socket) {
        socket.join(socket.params['room']!);
      },
      message() {},
    });
    app.ws('/events', (socket) => {
      socket.on('say', (text: string) => socket.to('lobby').emit('said', { text }));
    });
    const base = await start(app);

    const a = client(`${base}/chat/lobby`);
    const b = client(`${base}/chat/lobby`);
    const speaker = client(`${base}/events`);
    await Promise.all([a.opened, b.opened, speaker.opened]);
    await new Promise((r) => setTimeout(r, 20)); // let open handlers run

    speaker.ws.send(JSON.stringify({ event: 'say', data: 'hi' }));
    await until(() => a.received.length === 1 && b.received.length === 1);
    expect(a.received[0]).toEqual({ event: 'said', data: { text: 'hi' } });

    await app.to('lobby').send({ ping: true });
    await until(() => a.received.length === 2 && b.received.length === 2);
    expect(speaker.received).toEqual([]);
  });

  it('survives handlers that throw or reject, and reports them to `error`', async () => {
    const app = createApp();
    const errors: string[] = [];
    app.ws('/boom', {
      async message() {
        throw new Error('async bug');
      },
      error(_socket, err) {
        errors.push(err.message);
      },
    });
    const base = await start(app);
    const c = client(`${base}/boom`);
    await c.opened;
    c.ws.send('x');
    await until(() => errors.length === 1);
    expect(errors).toEqual(['async bug']);
    expect(c.ws.readyState).toBe(WebSocket.OPEN);
  });

  it('runs route middleware on the upgrade request', async () => {
    const app = createApp();
    app.ws('/private', signedIn, { open: (s) => s.send({ ok: true }) });
    const base = await start(app);
    await expect(client(`${base}/private`).opened).rejects.toThrow('HTTP 403');
    const ok = client(`${base}/private`, { 'x-user': '1' });
    await ok.opened;
    await until(() => ok.received.length === 1);
  });

  it('rejects other sites, unknown paths and oversized messages', async () => {
    const app = createApp();
    app.ws('/live', { message: (s, d) => s.send(d) });
    app.ws('/open', { origins: '*', message: () => {} });
    const base = await start(app);
    const host = base.replace('ws://', '');

    await expect(client(`${base}/live`, { origin: 'https://evil.example' }).opened).rejects.toThrow(
      'HTTP 403'
    );
    await client(`${base}/live`, { origin: `http://${host}` }).opened;
    await client(`${base}/open`, { origin: 'https://evil.example' }).opened;
    await expect(client(`${base}/nope`).opened).rejects.toThrow('HTTP 404');

    const big = client(`${base}/live`);
    await big.opened;
    const closed = new Promise<number>((r) => big.ws.once('close', (code) => r(code)));
    big.ws.send('x'.repeat(70 * 1024));
    expect(await closed).toBe(1009); // message too big
  });

  it('does not crash on a malformed Host header and closes sockets on server.close()', async () => {
    const app = createApp();
    app.ws('/live', { message: () => {} });
    const server = await app.listen(0, '127.0.0.1');
    const port = server.address!.port;
    await new Promise<void>((resolve) => {
      const s = net.connect(port, '127.0.0.1', () =>
        s.write(
          'GET /live HTTP/1.1\r\nHost: a b\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
            'Sec-WebSocket-Version: 13\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n'
        )
      );
      s.on('data', () => s.destroy());
      s.on('close', () => resolve());
    });

    const c = client(`ws://127.0.0.1:${port}/live`);
    await c.opened;
    const closed = new Promise<number>((r) => c.ws.once('close', (code) => r(code)));
    await server.close();
    expect(await closed).toBe(1001);
  });

  it('wsAgent streams a run and refuses a second run in parallel', async () => {
    const app = createApp();
    const bot = agent({
      name: 'Bot',
      instructions: 'Answer briefly',
      provider: new FakeLlmProvider().respond('Hello!'),
    });
    app.wsAgent('/agent', bot);
    const c = client(`${await start(app)}/agent`);
    await c.opened;
    c.ws.send(JSON.stringify({ input: 'hi' }));
    c.ws.send(JSON.stringify({ input: 'again' }));
    await until(() => c.received.some((e: any) => e.type === 'run.completed'));
    const types = c.received.map((e: any) => e.type);
    expect(types[0]).toBe('run.started');
    expect(c.received).toContainEqual({
      type: 'run.failed',
      error: 'A run is already in progress.',
    });
  });
});
