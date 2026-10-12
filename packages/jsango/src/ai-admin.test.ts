import { describe, it, expect, afterEach } from 'vitest';
import {
  createApp,
  agent,
  stt,
  tts,
  aiWidgets,
  aiAdminPage,
  recordTo,
  FakeLlmProvider,
  HttpRequest,
  InMemoryMediaStorage,
  VoiceSession,
  type Insights,
} from './index.js';

let insights: Insights | undefined;
afterEach(() => insights?.stop());

/** A short voice call: one turn, then hang up. Returns the session id. */
async function call(record?: ReturnType<typeof recordTo>) {
  const events: string[] = [];
  const session = new VoiceSession(
    agent({ name: 'Phone', provider: new FakeLlmProvider().respond('Sure.') }),
    {
      stt: stt(async () => 'help'),
      tts: tts(async () => new Int16Array(16000).fill(1000), { sampleRate: 16000 }),
      record,
    },
    {
      context: { user: { id: 'u1' } },
      inputRate: 16000,
      outputRate: 16000,
      output: { audio() {}, event: (e) => events.push(e.type), clear() {}, close() {} },
    }
  );
  await session.start();
  for (let i = 0; i < 20; i++) session.audio(new Int16Array(320).fill(6000));
  for (let i = 0; i < 30; i++) session.audio(new Int16Array(320));
  for (let i = 0; i < 200 && !events.includes('response.done'); i++)
    await new Promise((r) => setTimeout(r, 5));
  session.close('done');
  return session.id;
}

describe('AI in the admin', () => {
  it('serves AI widgets through the admin API (dashboard and page)', async () => {
    const app = createApp();
    insights = app.aiInsights({ prices: { fake: { input: 1, output: 1 } }, captureContent: true });
    app.admin({
      resources: [],
      credentials: { email: 'admin@example.com', password: 'test-password-1' },
      media: {},
      dashboard: aiWidgets(insights),
      pages: [aiAdminPage(insights)],
    });
    await agent({ name: 'Support', provider: new FakeLlmProvider().respond('ok') }).run('hi');
    await call();

    const get = async (url: string, token?: string, body?: unknown) => {
      const res = await app.handle(
        new HttpRequest({
          method: body ? 'POST' : 'GET',
          url: `http://localhost/admin/api/v1${url}`,
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : null,
        })
      );
      return JSON.parse(String(res.body));
    };
    const token = (
      await get('/auth/login', undefined, {
        email: 'admin@example.com',
        password: 'test-password-1',
      })
    ).data.token as string;

    expect((await get('/dashboard/widgets/ai-runs', token)).data.data.value).toBe(2); // text + voice run
    expect((await get('/dashboard/widgets/ai-voice-calls', token)).data.data.value).toBe(1);
    expect((await get('/dashboard/widgets/ai-cost', token)).data.data.value).toMatch(/^\$/);

    const chart = (await get('/dashboard/widgets/ai-usage-chart', token)).data.data;
    expect(chart.datasets.map((d: { label: string }) => d.label)).toEqual(['Runs', 'Voice calls']);

    const calls = (await get('/pages/ai/widgets/ai-recent-calls', token)).data.data;
    expect(calls.headers).toContain('Transcript');
    const row = calls.rows[0];
    expect(row[1]).toBe('Phone');
    expect(row[8]).toEqual({ label: '2 lines', details: 'Caller: help\nAgent: Sure.' });

    const pages = (await get('/pages', token)).data;
    expect(JSON.stringify(pages)).toContain('AI Usage');
  });

  it('records calls (caller + agent) to media storage and links them in insights', async () => {
    insights = createApp().aiInsights();
    const storage = new InMemoryMediaStorage();
    const id = await call(recordTo(storage));
    for (let i = 0; i < 100; i++) {
      if ((await insights.call(id))?.['recording_url']) break;
      await new Promise((r) => setTimeout(r, 5));
    }
    const detail = await insights.call(id);
    expect(String(detail!['recording_url'])).toMatch(/^data:audio\/wav/);

    const files = await storage.list!('ai-calls');
    expect(files).toHaveLength(1);
    const wav = Buffer.from(String(detail!['recording_url']).split(',')[1]!, 'base64');
    expect(wav.subarray(0, 4).toString()).toBe('RIFF');
    expect(wav.readUInt32LE(24)).toBe(16000);
    // ~1 s of caller audio, and the 1 s answer starts while the caller audio has ended
    expect(wav.readUInt32LE(40) / 2 / 16000).toBeGreaterThan(0.9);
  });
});
