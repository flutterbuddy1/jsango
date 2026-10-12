# Voice Agents

`app.voiceAgent()` lets users talk to the same agent you use for text. It uses the same
instructions, tools, permissions and memory. You choose every model. Nothing is tied to one
company.

```typescript
import { createApp, agent, deepgram, cartesia } from 'jsango';

const support = agent({
  provider: myLlm, // any LLM: OpenAI, Anthropic, Gemini, Ollama, provider(fn)…
  instructions: 'You are a friendly support agent. Keep answers short.',
  memory: true,
});

const app = createApp();
app.voiceAgent('/voice', support, {
  stt: deepgram(), // speech-to-text
  tts: cartesia({ voiceId: process.env.CARTESIA_VOICE! }), // text-to-speech
});
```

API keys stay on the server: the browser talks to your server, and your server talks to the
providers. Protect the route with `middleware: [auth.required()]`. Voice costs money per minute.

---

## Two Modes

|                                 | **Pipeline** `{ stt, tts }`                                       | **Realtime** `{ realtime }`                                                                        |
| ------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| LLM                             | the agent's own provider: any model                               | the speech-to-speech provider's model                                                              |
| Speech-to-text / text-to-speech | any: built-in adapters, self-hosted models, `stt(fn)` / `tts(fn)` | built into the provider                                                                            |
| Typical first-audio latency     | ~0.6–1.2 s (depends on your providers)                            | ~0.3–0.6 s                                                                                         |
| Tools, permissions              | same as `agent.run()`                                             | same as `agent.run()`                                                                              |
| Memory                          | agent memory (token budget, summary)                              | earlier turns are given to the provider at session start; finished turns are saved to agent memory |
| Turn detection                  | the provider's (Deepgram), or built-in silence detection          | the provider's                                                                                     |

```typescript
import { openaiRealtime, geminiLive } from 'jsango';

app.voiceAgent('/voice', support, { realtime: openaiRealtime({ voice: 'marin' }) });
app.voiceAgent('/voice-gemini', support, {
  realtime: geminiLive({ model: process.env.GEMINI_LIVE_MODEL! }),
});
```

---

## Built-in Adapters

Each adapter is a small file using only `fetch` or WebSocket (no vendor SDKs), and is only loaded
if you use it.

| Adapter                                                  | Kind               | Key (env)            | Notes                                                        |
| -------------------------------------------------------- | ------------------ | -------------------- | ------------------------------------------------------------ |
| `deepgram({ model?, language?, endpointingMs? })`        | STT, streaming     | `DEEPGRAM_API_KEY`   | `nova-3`, end-of-turn detection                              |
| `openaiStt({ model?, baseUrl? })`                        | STT, per utterance | `OPENAI_API_KEY`     | `gpt-transcribe`; any OpenAI-compatible server via `baseUrl` |
| `openaiTts({ voice?, model?, instructions?, baseUrl? })` | TTS, streaming     | `OPENAI_API_KEY`     | `gpt-4o-mini-tts`, 24 kHz                                    |
| `elevenlabs({ voiceId, model?, sampleRate? })`           | TTS, streaming     | `ELEVENLABS_API_KEY` | `eleven_flash_v2_5`                                          |
| `cartesia({ voiceId, model?, language? })`               | TTS, streaming     | `CARTESIA_API_KEY`   | `sonic-3.6`                                                  |
| `openaiRealtime({ voice?, model?, transcribe? })`        | speech-to-speech   | `OPENAI_API_KEY`     | `gpt-realtime`                                               |
| `geminiLive({ model, voice? })`                          | speech-to-speech   | `GEMINI_API_KEY`     | pass the Live model from Google's docs                       |

**Self-hosted models.** Servers with an OpenAI-compatible API (faster-whisper-server,
Kokoro-FastAPI, LocalAI and others) work through `baseUrl`, no key needed:

```typescript
app.voiceAgent('/voice', support, {
  stt: openaiStt({ baseUrl: 'http://localhost:8000/v1', model: 'Systran/faster-whisper-small' }),
  tts: openaiTts({ baseUrl: 'http://localhost:8880/v1', model: 'kokoro', voice: 'af_heart' }),
});
```

## Your Own Models: One Function Each

```typescript
import { stt, tts } from 'jsango';

// Speech-to-text: one utterance (PCM16 mono) in, text out. The session cuts utterances.
const myStt = stt(
  async (audio, { sampleRate, signal }) => {
    const res = await fetch('http://my-asr/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ audio: Buffer.from(audio.buffer).toString('base64'), sampleRate }),
      signal,
    });
    return (await res.json()).text;
  },
  { sampleRate: 16000 }
);

// Text-to-speech: a sentence in, PCM16 mono out (or yield chunks for lower latency).
const myTts = tts(
  async (text, { signal }) => {
    const res = await fetch('http://my-tts/speak', { method: 'POST', body: text, signal });
    return new Int16Array(await res.arrayBuffer());
  },
  { sampleRate: 22050 }
);

app.voiceAgent('/voice', support, { stt: myStt, tts: myTts });
```

Audio is resampled automatically: your model's rate ↔ the caller's rate. For streaming providers,
implement the `Stt` interface (`stream(audio)` yielding `{ text, final, endOfTurn }`) or the `Tts`
interface (`stream(text)` yielding audio). See `deepgram()` in `packages/ai/src/voice/providers.ts`,
which is about 60 lines.

---

## How Latency Is Kept Low (pipeline mode)

- The LLM streams tokens. Text is cut into sentences, and each sentence goes to
  text-to-speech **while the LLM is still writing**. The caller hears the first sentence early.
- Text-to-speech audio is sent as it is generated, never buffered whole.
- The turn ends on the speech-to-text provider's end-of-turn signal (Deepgram) or after 500 ms of
  silence (`vad: { silenceMs }`).
- Every reply reports `latency: { sttMs, llmMs, firstAudioMs }`, measured from the moment the
  user stopped talking, so you can see which provider is slow.

## Interruptions (barge-in)

When the user talks over the agent:

1. the server sends `speech.started`; the client stops playback;
2. the LLM and text-to-speech calls are **aborted** (no more tokens or audio are paid for);
3. memory keeps **only what the user heard**, e.g. `"Your order shipped on…"`. The client can
   send `{ type: 'interrupt', playedMs }` with the exact amount;
4. tool calls from a cancelled reply never run.

---

## Options

| Option         | Default                                                | What it does                                                           |
| -------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| `stt` + `tts`  |                                                        | pipeline mode                                                          |
| `realtime`     |                                                        | speech-to-speech mode                                                  |
| `middleware`   | none (public)                                          | auth and rate limits                                                   |
| `vad`          | `{ silenceMs: 500, minSpeechMs: 150, threshold: 500 }` | silence detection (pipeline)                                           |
| `maxSteps`     | 10                                                     | tool rounds per turn                                                   |
| `maxSessionMs` | 10 minutes                                             | hard limit per session                                                 |
| `onEvent`      | none                                                   | every event, plus `session.started` / `session.closed` (logs, metrics) |

## Protocol (browser ↔ server)

Wait for `ready` before sending audio.

**Client → server**: binary frames of PCM16 mono 24 kHz microphone audio (up to 256 KB each);
`{ "type": "text", "text": "..." }`; `{ "type": "interrupt", "playedMs": 1500 }`.

**Server → client**: binary frames of PCM16 mono 24 kHz audio, played in order, and JSON events:
`ready`, `speech.started` (stop playback), `transcript.delta`, `transcript { role, text, interrupted? }`,
`tool.started`, `tool.completed` / `tool.failed { name, durationMs }`,
`response.done { status, usage, latency }`, `error { error }` (details only in development; full
errors go to `onEvent`).

A working browser client (microphone, playback, interruption) is in
[examples/voice-agent/client.html](../../examples/voice-agent/client.html).

## Using a Session Without HTTP

`VoiceSession` is transport-independent. Feed it audio and send its output anywhere (phone
systems, desktop apps, tests):

```typescript
import { VoiceSession, openaiStt, openaiTts } from 'jsango';

const session = new VoiceSession(
  support,
  { stt: openaiStt(), tts: openaiTts() },
  {
    context: { user: { id: 'u1' }, conversationId: 'call-42' },
    inputRate: 16000,
    outputRate: 16000,
    output: {
      audio: (pcm) => speaker.write(pcm),
      event: (e) => console.log(e),
      clear: () => speaker.flush(),
      close: () => undefined,
    },
  }
);
await session.start();
microphone.on('data', (pcm: Int16Array) => session.audio(pcm));
```

## Not Supported Yet

- Phone calls and WebRTC transports (planned; see `docs/roadmap/ai-voice-platform.md`).
- Approval-required tools in voice: the agent says the action needs approval in the app.
- Gemini Live has no cancel or truncate call. An interrupted reply is dropped on our side, but
  Gemini's own memory may keep the full reply.

## Testing

Every adapter is tested against a fake server (`packages/ai/src/tests/voice-providers.test.ts`)
and the session against fake models (`voice-session.test.ts`), so the test suite needs no keys.
A live OpenAI Realtime test runs when `OPENAI_API_KEY` is set:

```bash
OPENAI_API_KEY=sk-... pnpm vitest run packages/jsango/src/voice.test.ts
```
