import { describe, it, expect, vi, afterEach } from 'vitest';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  openaiStt,
  openaiTts,
  elevenlabs,
  cartesia,
  deepgram,
  geminiLive,
  tool,
  type RealtimeEvent,
  type SttResult,
} from '../index.js';

const cleanup: Array<() => unknown> = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(cleanup.splice(0).map((c) => c()));
});

/** fetch stub returning PCM bytes split at odd offsets (as networks do). */
function stubFetch() {
  const fetchMock = vi.fn(
    async (..._args: unknown[]) =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(c) {
            c.enqueue(new Uint8Array([1, 0, 2]));
            c.enqueue(new Uint8Array([0, 3, 0]));
            c.close();
          },
        })
      )
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}
const req = (m: ReturnType<typeof stubFetch>) => {
  const [url, init] = m.mock.calls[0] as [string, RequestInit];
  return { url, init, headers: init.headers as Record<string, string> };
};
async function collect(it: AsyncIterable<Int16Array> | Promise<Int16Array>) {
  const out: number[] = [];
  if (it instanceof Promise) out.push(...(await it));
  else for await (const pcm of it) out.push(...pcm);
  return out;
}
const signal = new AbortController().signal;

async function fakeServer(onMessage: (ws: WebSocket, data: Buffer, isBinary: boolean) => void) {
  const wss = new WebSocketServer({ port: 0, host: '127.0.0.1' });
  await new Promise((r) => wss.once('listening', r));
  cleanup.push(() => new Promise((r) => wss.close(r)));
  const seen = { url: '', headers: {} as Record<string, unknown>, json: [] as any[], binary: 0 };
  let peer!: WebSocket;
  wss.on('connection', (ws, request) => {
    peer = ws;
    seen.url = request.url ?? '';
    seen.headers = request.headers;
    ws.on('message', (data: Buffer, isBinary) => {
      if (isBinary) seen.binary += data.length;
      else seen.json.push(JSON.parse(data.toString()));
      onMessage(ws, data, isBinary);
    });
  });
  return {
    url: `ws://127.0.0.1:${(wss.address() as { port: number }).port}`,
    seen,
    send: (m: unknown) => peer.send(JSON.stringify(m)),
  };
}

describe('text-to-speech adapters', () => {
  it('openaiTts streams PCM and asks for raw pcm', async () => {
    const f = stubFetch();
    const pcm = await collect(
      openaiTts({ apiKey: 'k', voice: 'cedar' }).synthesize!('Hello.', { signal })
    );
    expect(pcm).toEqual([1, 2, 3]);
    const { url, init, headers } = req(f);
    expect(url).toBe('https://api.openai.com/v1/audio/speech');
    expect(headers['Authorization']).toBe('Bearer k');
    expect(JSON.parse(init.body as string)).toMatchObject({
      model: 'gpt-4o-mini-tts',
      voice: 'cedar',
      input: 'Hello.',
      response_format: 'pcm',
    });
  });

  it('openaiTts talks to a local OpenAI-compatible server without a key', async () => {
    const f = stubFetch();
    await collect(
      openaiTts({ baseUrl: 'http://localhost:8880/v1', model: 'kokoro' }).synthesize!('Hi', {
        signal,
      })
    );
    expect(req(f).url).toBe('http://localhost:8880/v1/audio/speech');
    expect(req(f).headers['Authorization']).toBeUndefined();
  });

  it('elevenlabs: voice, PCM format and key header', async () => {
    const f = stubFetch();
    const voice = elevenlabs({ apiKey: 'xi', voiceId: 'v1', sampleRate: 16000 });
    expect(voice.sampleRate).toBe(16000);
    expect(await collect(voice.synthesize!('Hi', { signal }))).toEqual([1, 2, 3]);
    const { url, headers, init } = req(f);
    expect(url).toBe(
      'https://api.elevenlabs.io/v1/text-to-speech/v1/stream?output_format=pcm_16000'
    );
    expect(headers['xi-api-key']).toBe('xi');
    expect(JSON.parse(init.body as string)).toEqual({ text: 'Hi', model_id: 'eleven_flash_v2_5' });
  });

  it('cartesia: raw pcm_s16le and version header', async () => {
    const f = stubFetch();
    await collect(
      cartesia({ apiKey: 'sk_car_1', voiceId: 'v9', language: 'hi' }).synthesize!('नमस्ते', {
        signal,
      })
    );
    const { url, headers, init } = req(f);
    expect(url).toBe('https://api.cartesia.ai/tts/bytes');
    expect(headers['Authorization']).toBe('Bearer sk_car_1');
    expect(headers['Cartesia-Version']).toBe('2026-08-14');
    expect(JSON.parse(init.body as string)).toEqual({
      model_id: 'sonic-3.6',
      transcript: 'नमस्ते',
      voice: { id: 'v9' },
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: 24000 },
      language: 'hi',
    });
  });

  it('reports a missing key and HTTP errors clearly', async () => {
    const prev = process.env['ELEVENLABS_API_KEY'];
    delete process.env['ELEVENLABS_API_KEY'];
    cleanup.push(() => prev !== undefined && (process.env['ELEVENLABS_API_KEY'] = prev));
    await expect(
      collect(elevenlabs({ voiceId: 'v' }).synthesize!('x', { signal }))
    ).rejects.toThrow(/ELEVENLABS_API_KEY is not set/);
    vi.stubGlobal('fetch', async () => new Response('bad voice', { status: 422 }));
    await expect(
      collect(cartesia({ apiKey: 'k', voiceId: 'v' }).synthesize!('x', { signal }))
    ).rejects.toThrow(/422.*bad voice/);
  });
});

describe('speech-to-text adapters', () => {
  it('openaiStt uploads a WAV and returns the text', async () => {
    const f = vi.fn(async (..._a: unknown[]) => Response.json({ text: ' hello ' }));
    vi.stubGlobal('fetch', f);
    const text = await openaiStt({ apiKey: 'k' }).transcribe!(new Int16Array(1600), {
      sampleRate: 16000,
      signal,
    });
    expect(text).toBe('hello');
    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.openai.com/v1/audio/transcriptions');
    const form = init.body as FormData;
    expect(form.get('model')).toBe('gpt-transcribe');
    const file = form.get('file') as Blob;
    const bytes = Buffer.from(await file.arrayBuffer());
    expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
    expect(bytes.readUInt32LE(24)).toBe(16000);
    expect(bytes.length).toBe(44 + 3200);
  });

  it('deepgram streams audio and ends turns on speech_final / UtteranceEnd', async () => {
    const server = await fakeServer((ws, data, isBinary) => {
      if (isBinary) return;
      if (JSON.parse(data.toString()).type === 'CloseStream') ws.close();
    });
    async function* mic() {
      yield new Int16Array(160);
      await new Promise((r) => setTimeout(r, 30));
      server.send({
        type: 'Results',
        is_final: false,
        channel: { alternatives: [{ transcript: 'hel' }] },
      });
      server.send({
        type: 'Results',
        is_final: true,
        speech_final: true,
        channel: { alternatives: [{ transcript: 'hello there' }] },
      });
      server.send({ type: 'UtteranceEnd' });
      await new Promise((r) => setTimeout(r, 30));
      yield new Int16Array(160);
    }
    const results: SttResult[] = [];
    for await (const r of deepgram({ apiKey: 'dg', url: server.url, language: 'hi' }).stream!(
      mic(),
      {
        sampleRate: 16000,
        signal,
      }
    ))
      results.push(r);

    expect(server.seen.headers['authorization']).toBe('Token dg');
    const q = new URLSearchParams(server.seen.url.split('?')[1]);
    expect(Object.fromEntries(q)).toMatchObject({
      model: 'nova-3',
      encoding: 'linear16',
      sample_rate: '16000',
      language: 'hi',
      endpointing: '300',
    });
    expect(server.seen.binary).toBe(640);
    expect(results).toEqual([
      { text: 'hel', final: false },
      { text: 'hello there', final: true, endOfTurn: true },
      { text: '', final: true, endOfTurn: true },
    ]);
  });
});

describe('geminiLive realtime adapter', () => {
  it('sets up the session, streams audio, runs tool calls, handles interruptions', async () => {
    const server = await fakeServer((ws, data) => {
      if (JSON.parse(data.toString()).setup) ws.send(JSON.stringify({ setupComplete: {} }));
    });
    const lookup = tool({
      name: 'lookup',
      description: 'Find',
      input: { id: 'x' },
      execute: async () => 1,
    });
    const conn = await geminiLive({
      apiKey: 'g',
      model: 'gemini-live-x',
      voice: 'Kore',
      url: server.url,
    }).connect({
      instructions: 'Be brief.',
      tools: [lookup],
      history: [
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
      ],
      signal,
    });
    const events: RealtimeEvent[] = [];
    void (async () => {
      for await (const e of conn.events) events.push(e);
    })();
    const until = async (check: () => boolean) => {
      for (let i = 0; i < 200 && !check(); i++) await new Promise((r) => setTimeout(r, 5));
      expect(check()).toBe(true);
    };

    await until(() => events.some((e) => e.type === 'ready'));
    const setup = server.seen.json[0].setup;
    expect(server.seen.url).toContain('key=g');
    expect(setup.model).toBe('models/gemini-live-x');
    expect(setup.generationConfig.responseModalities).toEqual(['AUDIO']);
    expect(setup.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName).toBe(
      'Kore'
    );
    expect(setup.systemInstruction.parts[0].text).toContain('User: hi\nAssistant: hello');
    expect(setup.tools[0].functionDeclarations[0].name).toBe('lookup');

    conn.sendAudio(new Int16Array([5, 6]));
    await until(() => server.seen.json.length === 2);
    expect(server.seen.json[1].realtimeInput.audio.mimeType).toBe('audio/pcm;rate=16000');

    server.send({ serverContent: { inputTranscription: { text: 'order 7?' } } });
    server.send({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { data: Buffer.from([9, 0]).toString('base64') } }] },
      },
    });
    server.send({ serverContent: { outputTranscription: { text: 'Checking' } } });
    server.send({ toolCall: { functionCalls: [{ id: 'f1', name: 'lookup', args: { id: '7' } }] } });
    await until(() => events.some((e) => e.type === 'tool.call'));

    const audio = events.find((e) => e.type === 'audio') as Extract<
      RealtimeEvent,
      { type: 'audio' }
    >;
    expect([...audio.pcm]).toEqual([9]);
    expect(events.find((e) => e.type === 'transcript')).toEqual({
      type: 'transcript',
      role: 'user',
      text: 'order 7?',
    });
    const done = events.find((e) => e.type === 'response.done') as any;
    expect(done.status).toBe('completed');

    conn.toolResult('f1', { status: 'shipped' });
    conn.respond();
    await until(() => server.seen.json.some((m) => m.toolResponse));
    expect(server.seen.json.find((m) => m.toolResponse).toolResponse.functionResponses).toEqual([
      { id: 'f1', name: 'lookup', response: { output: { status: 'shipped' } } },
    ]);

    server.send({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAA=' } }] } } });
    server.send({ serverContent: { interrupted: true } });
    await until(() => events.some((e) => e.type === 'speech.started'));
    expect((events.at(-1) as any).status).toBe('cancelled');
    conn.close();
  });
});
