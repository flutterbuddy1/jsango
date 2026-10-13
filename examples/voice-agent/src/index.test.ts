import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { FakeLlmProvider, HttpRequest, stt, tts } from 'jsango';
import { createApplication } from './index.js';
import { voiceFromEnv } from './models.js';

const cleanup: Array<() => unknown> = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((c) => c()));
});
const until = async (check: () => boolean, ms = 3000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

/** Fake models: the LLM looks up order A100, then answers; speech is fixed audio. */
function fakes() {
  const llm = new FakeLlmProvider()
    .respondWithTool('lookup_order', { orderId: 'A100' })
    .respond('Your keyboard shipped and arrives tomorrow.');
  return {
    llm,
    voice: {
      stt: stt(async () => 'where is order A100'),
      tts: tts(async () => new Int16Array(1600).fill(500), { sampleRate: 16000 }),
    },
  };
}

describe('voice agent example', () => {
  it('answers a spoken question using the order tool', async () => {
    const server = await createApplication(fakes()).listen(0, '127.0.0.1');
    cleanup.push(() => server.close());
    const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
    const events: any[] = [];
    let audioBytes = 0;
    ws.on('message', (raw, isBinary) =>
      isBinary ? (audioBytes += (raw as Buffer).length) : events.push(JSON.parse(raw.toString()))
    );
    await until(() => events.some((e) => e.type === 'ready'));

    // 400 ms of "speech", then 600 ms of silence: the turn ends and the agent answers.
    const loud = Buffer.from(new Int16Array(480).fill(6000).buffer);
    for (let i = 0; i < 20; i++) ws.send(loud);
    for (let i = 0; i < 30; i++) ws.send(Buffer.alloc(960));
    await until(() => events.some((e) => e.type === 'response.done'));

    expect(events.filter((e) => e.type === 'transcript').map((e) => e.text)).toEqual([
      'where is order A100',
      'Your keyboard shipped and arrives tomorrow.',
    ]);
    expect(events.find((e) => e.type === 'tool.completed')?.name).toBe('lookup_order');
    expect(audioBytes).toBeGreaterThan(0);
    ws.close();
  });

  it('serves text chat, config and the admin AI page', async () => {
    const app = createApplication(fakes());
    const call = async (method: 'GET' | 'POST', url: string, body?: unknown, token?: string) => {
      const res = await app.handle(
        new HttpRequest({
          method,
          url: `http://localhost${url}`,
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: body === undefined ? null : JSON.stringify(body),
        })
      );
      return JSON.parse(String(res.body));
    };

    const chat = await call('POST', '/api/chat', { input: 'Where is order A100?' });
    expect(chat.text).toBe('Your keyboard shipped and arrives tomorrow.');
    expect(chat.toolCalls.map((t: { name: string }) => t.name)).toEqual(['lookup_order']);

    expect(await call('GET', '/config')).toEqual({ mode: 'custom', webrtc: false, phone: false });

    const login = await call('POST', '/admin/api/v1/auth/login', {
      email: 'admin@example.com',
      password: 'change-me-in-dev',
    });
    const pages = await call('GET', '/admin/api/v1/pages', undefined, login.data.token);
    expect(JSON.stringify(pages)).toContain('AI Usage');
  });

  it('picks models from the environment', () => {
    const was = { ...process.env };
    cleanup.push(() => {
      process.env = was;
    });
    process.env['VOICE'] = 'deepgram-cartesia';
    process.env['CARTESIA_VOICE_ID'] = 'v1';
    const pipeline = voiceFromEnv().voice;
    expect([pipeline.stt?.name, pipeline.tts?.name]).toEqual(['deepgram', 'cartesia']);

    process.env['VOICE'] = 'realtime';
    expect(voiceFromEnv().voice.realtime?.webrtc).toBeTypeOf('function');

    process.env['VOICE'] = 'elevenlabs';
    delete process.env['ELEVENLABS_VOICE_ID'];
    expect(() => voiceFromEnv()).toThrow(/ELEVENLABS_VOICE_ID is not set/);
  });
});
