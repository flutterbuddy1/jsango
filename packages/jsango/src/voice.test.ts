import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket, WebSocketServer } from 'ws';
import { createApp, agent, tool, stt, tts, FakeLlmProvider, openaiRealtime } from './index.js';

const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((c) => c()));
});

const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 10));
  }
};

/** A stand-in for the OpenAI Realtime API: records what it receives, sends what the test says. */
async function fakeRealtime() {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => wss.once('listening', r));
  cleanup.push(() => new Promise<void>((r) => wss.close(() => r())));
  const received: any[] = [];
  let auth = '';
  let peer: WebSocket | undefined;
  wss.on('connection', (ws, req) => {
    peer = ws;
    auth = req.headers.authorization ?? '';
    ws.on('message', (raw) => {
      const event = JSON.parse(raw.toString());
      received.push(event);
      if (event.type === 'session.update') ws.send(JSON.stringify({ type: 'session.updated' }));
    });
  });
  return {
    url: `ws://127.0.0.1:${(wss.address() as { port: number }).port}`,
    received,
    auth: () => auth,
    send: (event: unknown) => peer!.send(JSON.stringify(event)),
    hangUp: () => peer!.close(),
    of: (type: string) => received.filter((e) => e.type === type),
  };
}

async function setup(options: Record<string, unknown> = {}) {
  const upstream = await fakeRealtime();
  const calls: unknown[] = [];
  const lookup = tool({
    name: 'lookup_order',
    description: 'Find an order',
    input: { orderId: 'string' },
    execute: async (args: { orderId: string }) => {
      calls.push(args);
      return { status: 'shipped' };
    },
  });
  const bot = agent({
    instructions: 'You are a support agent.',
    provider: new FakeLlmProvider(),
    tools: { lookup },
  });
  const app = createApp();
  app.voiceAgent('/voice', bot, {
    realtime: openaiRealtime({ apiKey: 'sk-test', url: upstream.url }),
    ...options,
  });
  const server = await app.listen(0, '127.0.0.1');
  cleanup.push(() => server.close());

  const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
  const events: any[] = [];
  const audio: Buffer[] = [];
  ws.on('message', (raw, isBinary) =>
    isBinary ? audio.push(raw as Buffer) : events.push(JSON.parse(raw.toString()))
  );
  await until(() => events.some((e) => e.type === 'ready'));
  return { upstream, ws, events, audio, calls };
}

describe('app.voiceAgent', () => {
  it('configures the session from the agent and relays audio both ways', async () => {
    const { upstream, ws, audio } = await setup();
    expect(upstream.auth()).toBe('Bearer sk-test');
    const session = upstream.of('session.update')[0].session;
    expect(session.instructions).toBe('You are a support agent.');
    expect(session.tools.map((t: any) => t.name)).toEqual(['lookup_order']);
    expect(session.audio.input.format).toEqual({ type: 'audio/pcm', rate: 24000 });

    ws.send(Buffer.from([1, 2, 3, 4]));
    await until(() => upstream.of('input_audio_buffer.append').length === 1);
    expect(upstream.of('input_audio_buffer.append')[0].audio).toBe(
      Buffer.from([1, 2, 3, 4]).toString('base64')
    );

    upstream.send({ type: 'response.created', response: { id: 'r1' } });
    upstream.send({
      type: 'response.output_audio.delta',
      response_id: 'r1',
      item_id: 'i1',
      delta: Buffer.from([9, 9]).toString('base64'),
    });
    await until(() => audio.length === 1);
    expect([...audio[0]!]).toEqual([9, 9]);
  });

  it('runs tool calls on the server and asks for the follow-up reply', async () => {
    const { upstream, events, calls } = await setup();
    upstream.send({
      type: 'response.done',
      response: {
        id: 'r1',
        status: 'completed',
        output: [
          {
            type: 'function_call',
            name: 'lookup_order',
            call_id: 'c1',
            arguments: '{"orderId":"42"}',
          },
        ],
      },
    });
    await until(() => upstream.of('response.create').length === 1);
    expect(calls).toEqual([{ orderId: '42' }]);
    const out = upstream.of('conversation.item.create')[0].item;
    expect(out).toEqual({
      type: 'function_call_output',
      call_id: 'c1',
      output: JSON.stringify({ status: 'shipped' }),
    });
    expect(events.map((e) => e.type)).toContain('tool.completed');
  });

  it('interrupts: cancels, truncates to what was heard, drops stale audio and tool calls', async () => {
    const { upstream, ws, audio, calls } = await setup();
    upstream.send({ type: 'response.created', response: { id: 'r1' } });
    const delta = (id: string) =>
      upstream.send({
        type: 'response.output_audio.delta',
        response_id: id,
        item_id: 'i1',
        delta: Buffer.from([1, 1]).toString('base64'),
      });
    delta('r1');
    await until(() => audio.length === 1);

    ws.send(JSON.stringify({ type: 'interrupt', playedMs: 1500 }));
    await until(() => upstream.of('conversation.item.truncate').length === 1);
    expect(upstream.of('response.cancel')).toHaveLength(1);
    expect(upstream.of('conversation.item.truncate')[0]).toMatchObject({
      item_id: 'i1',
      content_index: 0,
      audio_end_ms: 1500,
    });

    delta('r1'); // late audio from the cancelled reply
    upstream.send({
      type: 'response.done',
      response: {
        id: 'r1',
        status: 'cancelled',
        output: [{ type: 'function_call', name: 'lookup_order', call_id: 'c1', arguments: '{}' }],
      },
    });
    upstream.send({ type: 'response.created', response: { id: 'r2' } });
    delta('r2');
    await until(() => audio.length === 2);
    expect(calls).toEqual([]);
    expect(upstream.of('response.create')).toHaveLength(0);
  });

  it('tells the client to stop playback when the user starts speaking', async () => {
    const { upstream, ws, events, audio } = await setup();
    upstream.send({ type: 'response.created', response: { id: 'r1' } });
    upstream.send({
      type: 'response.output_audio.delta',
      response_id: 'r1',
      item_id: 'i1',
      delta: Buffer.from([1, 1]).toString('base64'),
    });
    await until(() => audio.length === 1);
    upstream.send({ type: 'input_audio_buffer.speech_started' });
    upstream.send({
      type: 'conversation.item.input_audio_transcription.completed',
      transcript: 'where is my order',
    });
    await until(() => events.some((e) => e.type === 'transcript'));
    expect(events.map((e) => e.type)).toContain('speech.started');
    // The provider cancelled the reply itself; the client still reports what was heard.
    ws.send(JSON.stringify({ type: 'interrupt', playedMs: 700 }));
    await until(() => upstream.of('conversation.item.truncate').length === 1);
    expect(upstream.of('conversation.item.truncate')[0].audio_end_ms).toBe(700);
    expect(upstream.of('response.cancel')).toHaveLength(0);
    expect(events.find((e) => e.type === 'transcript')).toEqual({
      type: 'transcript',
      role: 'user',
      text: 'where is my order',
    });
  });

  it('rejects malformed audio and closes when the provider goes away', async () => {
    const { upstream, ws, events } = await setup();
    ws.send(Buffer.from([1, 2, 3])); // odd length: not PCM16
    await until(() => events.some((e) => e.type === 'error'));
    expect(upstream.of('input_audio_buffer.append')).toHaveLength(0);

    const closed = new Promise<number>((r) => ws.once('close', (code) => r(code)));
    upstream.hangUp();
    expect(await closed).toBe(1000);
  });

  it('pipeline mode end to end: any LLM, any speech-to-text and text-to-speech', async () => {
    const app = createApp();
    const routeEvents: string[] = [];
    app.voiceAgent('/voice', agent({ provider: new FakeLlmProvider().respond('Hello there.') }), {
      stt: stt(async () => 'hi'),
      tts: tts(async () => new Int16Array(800).fill(7), { sampleRate: 16000 }),
      onEvent: (e) => routeEvents.push(e.type),
    });
    const server = await app.listen(0, '127.0.0.1');
    cleanup.push(() => server.close());
    const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
    const events: any[] = [];
    const audio: Buffer[] = [];
    ws.on('message', (raw, isBinary) =>
      isBinary ? audio.push(raw as Buffer) : events.push(JSON.parse(raw.toString()))
    );
    await until(() => events.some((e) => e.type === 'ready'));

    const loud = Buffer.from(new Int16Array(480).fill(6000).buffer);
    const quiet = Buffer.alloc(960);
    for (let i = 0; i < 20; i++) ws.send(loud); // 400 ms of speech
    for (let i = 0; i < 30; i++) ws.send(quiet); // 600 ms of silence
    await until(() => events.some((e) => e.type === 'response.done'));

    expect(events.filter((e) => e.type === 'transcript').map((e) => [e.role, e.text])).toEqual([
      ['user', 'hi'],
      ['assistant', 'Hello there.'],
    ]);
    expect(audio).toHaveLength(1);
    expect(audio[0]!.length).toBe(1200 * 2); // 800 samples at 16 kHz -> 1200 at 24 kHz
    ws.close();
    await until(() => routeEvents.includes('session.closed'));
    expect(routeEvents[0]).toBe('session.started');
  });

  it('logs the full provider error on the server, and only a short one to the client in production', async () => {
    const logged: string[] = [];
    const logger = {
      debug() {},
      info() {},
      warn: (m: string) => logged.push(m),
      error: (m: string) => logged.push(m),
    };
    const app = createApp({ isProduction: true, logger: logger as never });
    app.voiceAgent('/voice', agent({ provider: new FakeLlmProvider() }), {
      stt: stt(async () => {
        throw new Error('model gpt-x does not exist');
      }),
      tts: tts(async () => new Int16Array(0), { sampleRate: 16000 }),
    });
    const server = await app.listen(0, '127.0.0.1');
    cleanup.push(() => server.close());
    const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
    const events: any[] = [];
    ws.on('message', (raw, isBinary) => !isBinary && events.push(JSON.parse(raw.toString())));
    await until(() => events.some((e) => e.type === 'ready'));
    for (let i = 0; i < 20; i++) ws.send(Buffer.from(new Int16Array(480).fill(6000).buffer));
    for (let i = 0; i < 30; i++) ws.send(Buffer.alloc(960));
    await until(() => events.some((e) => e.type === 'error'));

    expect(events.find((e) => e.type === 'error').error).toBe('Speech-to-text failed');
    expect(logged.join('\n')).toContain(
      'Voice error on /voice: Speech-to-text failed: model gpt-x does not exist'
    );
    ws.close();
  });

  it('reports a missing API key and closes', async () => {
    const prev = process.env['OPENAI_API_KEY'];
    delete process.env['OPENAI_API_KEY'];
    cleanup.push(() => {
      if (prev !== undefined) process.env['OPENAI_API_KEY'] = prev;
    });
    const { events, code } = await connect({ realtime: openaiRealtime() });
    expect(await code).toBe(1000);
    expect(events[0]).toEqual({
      type: 'error',
      error: 'Voice provider failed: OPENAI_API_KEY is not set',
    });
  });

  it('refuses a route with neither stt+tts nor realtime', async () => {
    const { events, code } = await connect({});
    expect(await code).toBe(1011);
    expect(events[0].error).toMatch(/stt, tts.*realtime/);
  });

  // Opt-in: runs against the real OpenAI Realtime API only when OPENAI_API_KEY is set.
  it.skipIf(!process.env['OPENAI_API_KEY'])(
    'live: answers a text message with audio and a transcript',
    async () => {
      const app = createApp();
      app.voiceAgent('/voice', agent({ instructions: 'Answer in one short sentence.' }), {
        realtime: openaiRealtime(),
      });
      const server = await app.listen(0, '127.0.0.1');
      cleanup.push(() => server.close());
      const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
      const events: any[] = [];
      let audioBytes = 0;
      ws.on('message', (raw, isBinary) =>
        isBinary ? (audioBytes += (raw as Buffer).length) : events.push(JSON.parse(raw.toString()))
      );
      await until(() => events.some((e) => e.type === 'ready'), 10_000);
      ws.send(JSON.stringify({ type: 'text', text: 'Say hello.' }));
      await until(() => events.some((e) => e.type === 'response.done'), 30_000);
      expect(events.filter((e) => e.type === 'error')).toEqual([]);
      expect(audioBytes).toBeGreaterThan(0);
      expect(events.some((e) => e.type === 'transcript' && e.role === 'assistant')).toBe(true);
      ws.close();
    },
    40_000
  );
});

/** Opens a voice route with these options; resolves the close code. */
async function connect(options: Record<string, unknown>) {
  const app = createApp();
  app.voiceAgent('/voice', agent({ provider: new FakeLlmProvider() }), options);
  const server = await app.listen(0, '127.0.0.1');
  cleanup.push(() => server.close());
  const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
  const events: any[] = [];
  ws.on('message', (raw) => events.push(JSON.parse(raw.toString())));
  const code = new Promise<number>((r) => ws.once('close', (c) => r(c)));
  return { events, code };
}
