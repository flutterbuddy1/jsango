import { describe, it, expect } from 'vitest';
import {
  agent,
  tool,
  stt,
  tts,
  sentences,
  resample,
  mulawDecode,
  mulawEncode,
  FakeLlmProvider,
  VoiceSession,
  type VoiceEvent,
  type Stt,
  type Tts,
  type VoiceOptions,
} from '../index.js';

const RATE = 24000;
const frame = (level: number) => new Int16Array(480).fill(level); // 20 ms
const speech = (ms: number) => Array.from({ length: ms / 20 }, () => frame(6000));
const silence = (ms: number) => Array.from({ length: ms / 20 }, () => frame(0));

const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

/** A session wired to arrays instead of a socket. */
function harness(bot: ReturnType<typeof agent>, options: VoiceOptions) {
  const events: VoiceEvent[] = [];
  const audio: Int16Array[] = [];
  let cleared = 0;
  const session = new VoiceSession(bot, options, {
    context: { user: { id: 'u1' }, conversationId: 'c1' },
    inputRate: RATE,
    outputRate: RATE,
    output: {
      audio: (pcm) => audio.push(pcm),
      event: (e) => events.push(e),
      clear: () => cleared++,
      close: () => undefined,
    },
  });
  const say = (frames: Int16Array[]) => frames.forEach((f) => session.audio(f));
  const of = <T extends VoiceEvent['type']>(type: T) =>
    events.filter((e) => e.type === type) as Extract<VoiceEvent, { type: T }>[];
  return { session, events, audio, say, of, cleared: () => cleared };
}

/** Text-to-speech that returns 10 ms of audio per character and records what it spoke. */
function fakeTts(spoken: string[], signals: AbortSignal[] = []): Tts {
  return tts(
    async (text, { signal }) => {
      spoken.push(text);
      signals.push(signal);
      return new Int16Array(text.length * 160).fill(100); // 16 kHz
    },
    { sampleRate: 16000 }
  );
}

describe('VoiceSession: pipeline mode (any LLM)', () => {
  it('hears a turn, answers with any provider, speaks sentence by sentence, saves memory', async () => {
    const heard: number[] = [];
    const whisper: Stt = stt(async (pcm, { sampleRate }) => {
      heard.push(pcm.length, sampleRate);
      return 'where is my order';
    });
    const spoken: string[] = [];
    const bot = agent({
      provider: new FakeLlmProvider().respond('It shipped yesterday. It arrives tomorrow.'),
      memory: true,
    });
    const h = harness(bot, { stt: whisper, tts: fakeTts(spoken) });
    await h.session.start();
    expect(h.events[0]).toEqual({ type: 'ready' });

    h.say([...silence(200), ...speech(600), ...silence(600)]);
    await until(() => h.of('response.done').length === 1);

    // ~300 ms pre-roll + speech + trailing silence, resampled 24k -> 16k
    expect(heard[1]).toBe(16000);
    expect(heard[0]).toBeGreaterThan(16000 * 0.6);
    expect(h.of('speech.started')).toHaveLength(1);
    expect(h.of('transcript')[0]).toEqual({
      type: 'transcript',
      role: 'user',
      text: 'where is my order',
    });
    expect(spoken).toEqual(['It shipped yesterday.', 'It arrives tomorrow.']);
    expect(h.audio.length).toBe(2);
    expect(h.audio[0]!.length).toBe(Math.round('It shipped yesterday.'.length * 160 * 1.5)); // 16k -> 24k

    const done = h.of('response.done')[0]!;
    expect(done.status).toBe('completed');
    expect(done.latency.firstAudioMs).toBeGreaterThanOrEqual(0);
    expect(done.latency.llmMs).toBeGreaterThanOrEqual(0);

    const history = await bot.history({ user: { id: 'u1' }, conversationId: 'c1' });
    expect(history.map((m) => m.content)).toEqual([
      'where is my order',
      'It shipped yesterday. It arrives tomorrow.',
    ]);
  });

  it('runs tools with the same agent', async () => {
    const calls: unknown[] = [];
    const lookup = tool({
      name: 'lookup',
      description: 'Look up an order',
      input: { id: 'string' },
      execute: async (args: { id: string }) => {
        calls.push(args);
        return 'shipped';
      },
    });
    const fake = new FakeLlmProvider().respondWithTool('lookup', { id: '42' }).respond('Shipped.');
    const spoken: string[] = [];
    const h = harness(agent({ provider: fake, tools: { lookup } }), {
      stt: stt(async () => 'order 42?'),
      tts: fakeTts(spoken),
    });
    await h.session.start();
    h.say([...speech(400), ...silence(600)]);
    await until(() => h.of('response.done').length === 1);
    expect(calls).toEqual([{ id: '42' }]);
    expect(h.of('tool.completed')[0]!.name).toBe('lookup');
    expect(spoken).toEqual(['Shipped.']);
  });

  it('barge-in: stops speaking, aborts the reply, remembers only what was heard', async () => {
    let release!: () => void;
    const slowSecondSentence = new Promise<void>((r) => (release = r));
    const signals: AbortSignal[] = [];
    const spoken: string[] = [];
    const bot = agent({
      provider: new FakeLlmProvider().respond(
        'First part of the answer. Second part that never plays.'
      ),
      memory: true,
    });
    const slowTts = tts(
      async (text, { signal }) => {
        spoken.push(text);
        signals.push(signal);
        if (spoken.length === 2) await slowSecondSentence;
        return new Int16Array(16000).fill(100); // 1 s each
      },
      { sampleRate: 16000 }
    );
    const h = harness(bot, { stt: stt(async () => 'tell me'), tts: slowTts });
    await h.session.start();
    h.say([...speech(400), ...silence(600)]);
    await until(() => h.audio.length === 1);

    h.session.interrupt(500); // the user heard half of the first second
    release();
    await until(() => h.of('response.done').length === 1);

    expect(h.of('response.done')[0]!.status).toBe('interrupted');
    expect(signals[1]!.aborted).toBe(true);
    expect(h.audio).toHaveLength(1); // the second sentence never went out
    const interrupted = h.of('transcript').find((t) => t.interrupted)!;
    expect(interrupted.text).toBe('First part of');
    const history = await bot.history({ user: { id: 'u1' }, conversationId: 'c1' });
    expect(history.at(-1)!.content).toBe('First part of…');
  });

  it('speech over the agent cancels the reply (voice activity)', async () => {
    const h = harness(
      agent({ provider: new FakeLlmProvider().respond('A long answer. And more.') }),
      {
        stt: stt(async () => 'hi'),
        tts: tts(
          async (_t, { signal }) =>
            new Promise((resolve) => {
              signal.addEventListener('abort', () => resolve(new Int16Array(0)));
            }),
          { sampleRate: 16000 }
        ),
      }
    );
    await h.session.start();
    h.say([...speech(400), ...silence(600)]);
    await until(() => h.of('transcript').length === 1);
    h.say(speech(300));
    await until(() => h.of('response.done').length === 1);
    expect(h.of('response.done')[0]!.status).toBe('interrupted');
    expect(h.of('speech.started')).toHaveLength(2);
    expect(h.cleared()).toBeGreaterThan(0);
  });

  it('streaming speech-to-text ends the turn on the provider signal', async () => {
    const streaming: Stt = {
      name: 'stream',
      sampleRate: 16000,
      async *stream(audio) {
        let n = 0;
        for await (const _ of audio)
          if (++n === 5) yield { text: 'hello', final: true, endOfTurn: true };
      },
    };
    const spoken: string[] = [];
    const h = harness(agent({ provider: new FakeLlmProvider().respond('Hi!') }), {
      stt: streaming,
      tts: fakeTts(spoken),
    });
    await h.session.start();
    h.say(silence(200)); // quiet audio: voice activity never fires, the provider ends the turn
    await until(() => h.of('response.done').length === 1);
    expect(h.of('transcript')[0]!.text).toBe('hello');
    expect(spoken).toEqual(['Hi!']);
  });

  it('streaming text-to-speech gets the answer as it is written', async () => {
    const got: string[] = [];
    const streamingTts: Tts = {
      name: 'stream',
      sampleRate: 24000,
      async *stream(text) {
        for await (const piece of text) {
          got.push(piece);
          yield new Int16Array(240);
        }
      },
    };
    const h = harness(agent({ provider: new FakeLlmProvider().respond('One. Two.') }), {
      stt: stt(async () => 'count'),
      tts: streamingTts,
    });
    await h.session.start();
    h.session.text('count');
    await until(() => h.of('response.done').length === 1);
    expect(got).toEqual(['One.', 'Two.']);
  });

  it('rejects incomplete configuration', () => {
    const bot = agent({ provider: new FakeLlmProvider() });
    const init = {
      context: {},
      inputRate: RATE,
      outputRate: RATE,
      output: { audio() {}, event() {}, clear() {}, close() {} },
    };
    expect(() => new VoiceSession(bot, { stt: stt(async () => '') }, init)).toThrow(/stt, tts/);
    expect(() => new VoiceSession(bot, { stt: { name: 'x' }, tts: fakeTts([]) }, init)).toThrow(
      /neither transcribe nor stream/
    );
  });
});

describe('voice building blocks', () => {
  it('splits streamed text into speakable pieces', async () => {
    async function* tokens() {
      yield* ['Sure, let me check that for you right now', '. Your order', ' shipped.', ' Thanks'];
    }
    const out: string[] = [];
    for await (const s of sentences(tokens())) out.push(s);
    // "Sure," alone is too short to sound natural, so the first piece waits for more text.
    expect(out).toEqual([
      'Sure, let me check that for you right now.',
      'Your order shipped.',
      'Thanks',
    ]);
  });

  it('converts phone audio and sample rates', () => {
    const pcm = Int16Array.from([0, 1000, -1000, 32000, -32000]);
    const back = mulawDecode(mulawEncode(pcm));
    pcm.forEach((v, i) =>
      expect(Math.abs(back[i]! - v)).toBeLessThan(Math.max(64, Math.abs(v) * 0.05))
    );
    expect(resample(new Int16Array(160), 8000, 24000)).toHaveLength(480);
  });
});
