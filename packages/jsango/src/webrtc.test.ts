import { describe, it, expect, afterEach, vi } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import { createApp, agent, tool, FakeLlmProvider, openaiRealtime, HttpRequest } from './index.js';

const cleanup: Array<() => unknown> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((c) => c()));
  vi.unstubAllGlobals();
});
const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

async function setup(options: { status?: number; maxSessionMs?: number } = {}) {
  // Sideband: a fake Realtime control socket.
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => wss.once('listening', r));
  cleanup.push(() => {
    for (const client of wss.clients) client.terminate();
    return new Promise((r) => wss.close(r));
  });
  const sideband = { url: '', received: [] as any[], peer: undefined as WebSocket | undefined };
  wss.on('connection', (ws, req) => {
    sideband.url = req.url ?? '';
    sideband.peer = ws;
    ws.on('message', (raw) => {
      const e = JSON.parse(raw.toString());
      sideband.received.push(e);
      if (e.type === 'session.update') ws.send(JSON.stringify({ type: 'session.updated' }));
    });
  });

  // OpenAI REST: create call + hangup.
  const rest: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    rest.push({ url, body: init.body });
    if (url.endsWith('/hangup')) return new Response(null, { status: 200 });
    if (options.status) return new Response('nope', { status: options.status });
    return new Response('v=0 answer-sdp', { headers: { location: '/v1/realtime/calls/rtc_42' } });
  });

  const calls: unknown[] = [];
  const lookup = tool({
    name: 'lookup',
    description: 'Find',
    input: { id: 'string' },
    execute: async (a: { id: string }) => {
      calls.push(a);
      return 'found';
    },
  });
  const app = createApp();
  app.webrtcAgent(
    '/rtc',
    agent({ instructions: 'Be kind.', provider: new FakeLlmProvider(), tools: { lookup } }),
    {
      realtime: openaiRealtime({
        apiKey: 'sk',
        apiUrl: 'http://openai.test/v1',
        url: `ws://127.0.0.1:${(wss.address() as { port: number }).port}/realtime`,
      }),
      maxSessionMs: options.maxSessionMs,
    }
  );
  const offer = (body: string) =>
    app.handle(
      new HttpRequest({
        method: 'POST',
        url: 'http://localhost/rtc',
        headers: { 'content-type': 'application/sdp' },
        body,
      })
    );
  return { offer, rest, sideband, calls };
}

describe('app.webrtcAgent', () => {
  it('creates the call with the server key and runs tools on the sideband', async () => {
    const { offer, rest, sideband, calls } = await setup();
    const res = await offer('v=0 browser-offer');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/sdp');
    expect(String(res.body)).toBe('v=0 answer-sdp');

    const form = rest[0]!.body as FormData;
    expect(rest[0]!.url).toBe('http://openai.test/v1/realtime/calls');
    expect(form.get('sdp')).toBe('v=0 browser-offer');
    const session = JSON.parse(String(form.get('session')));
    expect(session).toMatchObject({
      type: 'realtime',
      model: 'gpt-realtime',
      instructions: 'Be kind.',
    });
    expect(session.audio.input.format).toBeUndefined(); // WebRTC audio is Opus, not PCM
    expect(session.tools[0].name).toBe('lookup');
    expect(sideband.url).toBe('/realtime?call_id=rtc_42');

    sideband.peer!.send(
      JSON.stringify({
        type: 'response.done',
        response: {
          id: 'r1',
          status: 'completed',
          output: [
            { type: 'function_call', name: 'lookup', call_id: 'c1', arguments: '{"id":"7"}' },
          ],
        },
      })
    );
    await until(() => sideband.received.some((e) => e.type === 'response.create'));
    expect(calls).toEqual([{ id: '7' }]);
    expect(sideband.received.find((e) => e.type === 'conversation.item.create').item.call_id).toBe(
      'c1'
    );
  });

  it('hangs up the call when the session time limit is reached', async () => {
    const { offer, rest } = await setup({ maxSessionMs: 50 });
    await offer('v=0 offer');
    await until(() => rest.some((r) => r.url.endsWith('/hangup')));
    expect(rest.at(-1)!.url).toBe('http://openai.test/v1/realtime/calls/rtc_42/hangup');
  });

  it('rejects bad offers and reports provider failures without details', async () => {
    const { offer } = await setup({ status: 401 });
    expect((await offer('hello')).status).toBe(400);
    const failed = await offer('v=0 offer');
    expect(failed.status).toBe(502);
    expect(String(failed.body)).not.toContain('nope');
  });

  it('refuses adapters without WebRTC support', () => {
    const app = createApp();
    const { webrtc: _, ...withoutWebRtc } = openaiRealtime();
    expect(() =>
      app.webrtcAgent('/rtc', agent({ provider: new FakeLlmProvider() }), {
        realtime: withoutWebRtc,
      })
    ).toThrow(/does not support WebRTC/);
  });
});
