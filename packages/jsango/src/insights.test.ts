import { describe, it, expect, afterEach } from 'vitest';
import {
  agent,
  stt,
  tts,
  createInsights,
  DatabaseManager,
  FakeLlmProvider,
  MetricRegistry,
  MemoryInsightsStore,
  VoiceSession,
  type Insights,
} from './index.js';

let insights: Insights | undefined;
afterEach(() => insights?.stop());

const prices = {
  'gpt-test': { input: 1, output: 2 }, // USD per 1M tokens
  'speech-in': { perMinute: 0.006 },
  'speech-out': { perMinute: 0.03 },
};

/** A 20 ms frame: loud (speech) or silent. */
const frame = (level: number) => new Int16Array(480).fill(level);

async function voiceCall(bot: ReturnType<typeof agent<string>>) {
  const done: string[] = [];
  const session = new VoiceSession(
    bot,
    {
      stt: stt(async () => 'hello', { name: 'speech-in' }),
      tts: tts(async () => new Int16Array(24000), { sampleRate: 24000, name: 'speech-out' }), // 1 s
    },
    {
      context: { user: { id: 'u1' } },
      inputRate: 24000,
      outputRate: 24000,
      output: { audio() {}, event: (e) => done.push(e.type), clear() {}, close() {} },
    }
  );
  await session.start();
  for (let i = 0; i < 20; i++) session.audio(frame(6000));
  for (let i = 0; i < 30; i++) session.audio(frame(0));
  for (let i = 0; i < 100 && !done.includes('response.done'); i++)
    await new Promise((r) => setTimeout(r, 5));
  session.close('done');
  return session.id;
}

describe('AI insights', () => {
  it('records text runs with tokens and cost, without content by default', async () => {
    insights = createInsights({ prices });
    const bot = agent({
      name: 'Support',
      model: 'gpt-test',
      provider: new FakeLlmProvider().respond('four words in here'),
    });
    await bot.run({ input: 'secret question', context: { user: { id: 'u7' } } });
    await expect(
      agent({
        name: 'Broken',
        provider: {
          name: 'x',
          generate: async () => {
            throw new Error('model down');
          },
          stream: async () => {
            throw new Error('x');
          },
        },
      }).run('hi')
    ).rejects.toThrow('model down');

    const s = await insights.summary();
    expect(s.runs).toBe(2);
    expect(s.failedRuns).toBe(1);
    expect(s.tokens).toEqual({ input: 10, output: 4, total: 14 });
    expect(s.costUsd).toBeCloseTo((10 * 1 + 4 * 2) / 1e6);
    expect(s.byAgent.find((a) => a.agent === 'Broken')!.failed).toBe(1);

    const [failed, ok] = await insights.runs();
    expect(failed!['error']).toBe('model down');
    expect(ok!['user_id']).toBe('u7');
    expect(ok!['input']).toBeNull(); // content is off by default
  });

  it('captures content only when asked', async () => {
    insights = createInsights({ captureContent: true });
    await agent({ provider: new FakeLlmProvider().respond('answer') }).run('question');
    const [run] = await insights.runs();
    expect([run!['input'], run!['output']]).toEqual(['question', 'answer']);
  });

  it('records voice calls: turns, latency, audio minutes and per-minute speech cost', async () => {
    insights = createInsights({ prices, captureContent: true });
    const bot = agent({ model: 'gpt-test', provider: new FakeLlmProvider().respond('Hi there.') });
    const id = await voiceCall(bot);

    const call = await insights.call(id);
    expect(call).toMatchObject({
      status: 'ended',
      mode: 'pipeline',
      turns: 1,
      interruptions: 0,
      user_id: 'u1',
    });
    expect(call!['audio_in_ms']).toBe(1000);
    expect(call!['audio_out_ms']).toBe(1000);
    expect(call!.timeline).toHaveLength(1);
    expect(call!.timeline[0]!['first_audio_ms']).toBeGreaterThanOrEqual(0);
    expect(call!.transcript).toEqual([
      { role: 'user', text: 'hello' },
      { role: 'assistant', text: 'Hi there.' },
    ]);

    // LLM (10 in, 2 out tokens) + 1 min/60 of speech-to-text + 1 min/60 of text-to-speech
    const expected = (10 * 1 + 2 * 2) / 1e6 + 0.006 / 60 + 0.03 / 60;
    expect(Number(call!['cost_micros']) / 1e6).toBeCloseTo(expected, 8);
    const s = await insights.summary();
    expect(s.calls).toBe(1);
    expect(s.costUsd).toBeCloseTo(expected, 8); // the voice run is not counted twice
    expect(s.latency.firstAudioP50).not.toBeNull();
    const [run] = await insights.runs();
    expect(run).toMatchObject({ channel: 'voice', call_id: id });
  });

  it('stores in a SQL database (SQLite) and answers the same queries', async () => {
    const db = new DatabaseManager({
      default: 'default',
      connections: { default: { driver: 'sqlite', filename: ':memory:' } },
    });
    insights = createInsights({ store: db, prices });
    await agent({ model: 'gpt-test', provider: new FakeLlmProvider().respond('ok') }).run('x');
    const id = await voiceCall(
      agent({ model: 'gpt-test', provider: new FakeLlmProvider().respond('Yes.') })
    );

    const s = await insights.summary();
    expect(s.runs).toBe(2);
    expect(s.calls).toBe(1);
    expect((await insights.call(id))!['turns']).toBe(1);
    const series = await insights.series({ bucket: 'hour' });
    expect(series.runs.reduce((a, b) => a + b, 0)).toBe(2);
    expect(series.calls.reduce((a, b) => a + b, 0)).toBe(1);
    const tables = await db.query(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'ai_%'"
    );
    expect(tables.rows.map((r) => r['name']).sort()).toEqual(['ai_calls', 'ai_runs', 'ai_turns']);
  });

  it('updates Prometheus metrics', async () => {
    const metrics = new MetricRegistry();
    insights = createInsights({ metrics, prices });
    await agent({
      name: 'Bot',
      model: 'gpt-test',
      provider: new FakeLlmProvider().respond('a b'),
    }).run('x');
    await voiceCall(agent({ provider: new FakeLlmProvider().respond('Hi.') }));
    const text = metrics.toPrometheus();
    expect(text).toContain('ai_runs_total{agent="Bot",status="completed"} 1');
    expect(text).toContain('ai_tokens_total{model="gpt-test",direction="input"} 10');
    expect(text).toContain('voice_first_audio_seconds_count 1');
    expect(text).toContain('voice_active_calls 0');
  });

  it('deletes records older than the retention period, and stop() ends recording', async () => {
    const store = new MemoryInsightsStore();
    await store.insert('runs', {
      id: 'old',
      at: new Date(Date.now() - 40 * 86_400_000).toISOString(),
    });
    insights = createInsights({ store, retentionDays: 30 });
    await insights.flush();
    expect(await store.select('runs', { since: '0', until: '9' })).toHaveLength(0);

    insights.stop();
    await agent({ provider: new FakeLlmProvider() }).run('x');
    expect((await insights.summary()).runs).toBe(0);
  });
});
