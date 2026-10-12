# Plan: Vendor-Neutral Voice Agents, Calling, and AI Insights

Status: proposal (2026-10-12). Branch `feat/ai-provider-memory-voice` has the first slice:
`provider()`, token-efficient memory, and `app.voiceAgent()` on OpenAI Realtime.

## Goals

1. **No vendor lock-in.** Any LLM, any speech-to-text (STT), and any text-to-speech (TTS),
   including self-hosted models. Each one plugs in with one function, the same way `provider(fn)`
   works.
2. **Low latency.** About 500–800 ms from the end of the user's speech to the first audio, on
   streaming providers.
3. **Real products.** Browser voice (WebSocket and WebRTC) and phone calling agents (inbound and
   outbound).
4. **See everything.** Usage, cost, latency, calls, transcripts and recordings, as metrics, an
   API, and admin widgets.
5. **Stay light.** The core adds no dependencies. Heavy parts (WebRTC) are optional packages.

## What Exists and Gets Reused

| Need | Already in JSango |
| --- | --- |
| Transport, auth, origin checks, backpressure | `app.ws()` (`websocket-wrapper.ts`) |
| Any LLM | `ILlmProvider`, `provider(fn)`, `ModelRouter` |
| Tools with permissions | `agent.callTool()`, `ToolExecutor` |
| Conversation state | `memory` + `history` budget (token-efficient) |
| Metrics | `@jsango/observability` (counter, gauge, histogram, Prometheus) |
| Dashboards | admin `DashboardWidget` (metric, table, chart, activity) |
| Recordings storage | `admin-media` (`LocalDiskMediaStorage`, `S3MediaStorage`) |
| Background work | `@jsango/queue` (outbound calls, post-call jobs) |

## Gaps Found

- **`message.delta` is documented but never emitted.** `Agent.run()` calls `provider.generate()`,
  never `provider.stream()`, and `agent.stream()` polls every 20 ms. There is no token streaming,
  which voice latency depends on.
- **Voice is speech-to-speech only and OpenAI only.** The agent's own provider is ignored there.
- **Cost is hardcoded per provider** (e.g. Anthropic and Gemini prices are in the code) and
  goes stale.
- **No record of runs or calls.** Nothing exists to build dashboards from.

---

## Architecture

```
               ┌──────────── transports (where audio comes from) ────────────┐
               │ browser WebSocket │ WebRTC (optional pkg) │ phone (Twilio,   │
               │ (PCM16)           │ (Opus)                │ Telnyx, Plivo…)  │
               └─────────┬─────────┴───────────┬───────────┴────────┬─────────┘
                         ▼   audio frames (PCM16, any rate)          ▼
                  ┌──────────────────── VoiceSession ─────────────────────┐
                  │ turn detection · barge-in · cancellation · metrics    │
                  │                                                        │
   pipeline mode: │  stt(fn) ──► agent (any provider, tools, memory) ──►  │
                  │              tts(fn)  (all streaming)                  │
   realtime mode: │  realtime adapter (OpenAI Realtime, Gemini Live, …)   │
                  └───────────────────────────┬────────────────────────────┘
                                              ▼ one event stream
                           insights: metrics · DB records · admin widgets
```

One `VoiceSession` owns the call lifecycle. Pipeline mode and realtime mode are the same session
with a different "brain". Transports only move audio in and out.

### Developer API (target)

```ts
// Any STT, LLM and TTS: each is one function, or a ready adapter.
app.voiceAgent('/voice', support, {
  stt: deepgram({ model: 'nova-3' }),        // or stt(async function* (audio) { ... })
  tts: cartesia({ voice: '...' }),           // or tts(async function* (text) { ... })
  // the LLM is the agent's own provider: OpenAI, Anthropic, Gemini, Ollama, provider(fn)…
});

// Speech-to-speech instead (lowest latency, provider-specific):
app.voiceAgent('/voice', support, { realtime: openaiRealtime() });

// Phone calls: same agent, a different transport.
app.voiceAgent('/calls/twilio', support, { stt, tts, transport: twilio() });
await calls.dial('+91…', { agent: support, via: twilio({ from: '+1…' }) }); // outbound

// Observability: one line.
app.aiInsights({ store: db });               // records + metrics + admin widgets
```

### Plug-in Contracts (all streaming, all cancellable)

```ts
type Stt = (audio: AsyncIterable<Int16Array>, o: { sampleRate: number; signal: AbortSignal })
  => AsyncIterable<{ text: string; final: boolean; endOfTurn?: boolean }>;

type Tts = (text: AsyncIterable<string>, o: { signal: AbortSignal })
  => AsyncIterable<{ audio: Int16Array; sampleRate: number }>;

interface RealtimeAdapter {           // speech-to-speech providers
  connect(session: { instructions: string; tools: ToolDefinition[]; signal: AbortSignal }):
    Promise<{ send(audio: Int16Array): void; events: AsyncIterable<RealtimeEvent>;
              interrupt(heardMs?: number): void; respondTool(id: string, output: unknown): void }>;
}
```

`stt(fn)` and `tts(fn)` wrap a plain function, like `provider(fn)`. Built-in adapters use only
`fetch` and `ws` (no vendor SDKs), one small file each, imported only if used.

---

## Latency Design (pipeline mode)

| Step | Technique | Target |
| --- | --- | --- |
| End of turn | Use the STT's own endpointing (`endOfTurn`) when it has it; otherwise a built-in energy VAD with silence timeout (default 500 ms) | 300–500 ms |
| LLM | **Real token streaming** (Phase 0); start the moment the turn ends | first token 200–400 ms |
| Text → speech | Split the token stream into sentences/clauses and send each to TTS immediately; never wait for the full reply | first audio about 150 ms after the first clause |
| Playback | Stream audio frames as they come; no buffering of the whole reply | — |
| Barge-in | User speech aborts the LLM and TTS (`AbortSignal`) and stops playback; history is cut to what was heard | under 100 ms |
| Tools | Optional short filler ("one moment…") for tools that take longer than 1 s | — |
| Connections | Keep STT/TTS sockets open for the whole call; never reconnect per turn | — |

Each of these is measured per turn (see Insights). Realtime mode stays available for the lowest
latency.

## Transports

- **WebSocket (browser/app):** exists. Becomes one transport of `VoiceSession`.
- **Phone, inbound and outbound:** Twilio Media Streams, Telnyx and Plivo all send μ-law 8 kHz
  over a WebSocket. Implement μ-law ↔ PCM16 and resampling (8/16/24/48 kHz) in pure TypeScript
  (about 100 lines). This is the fastest path to calling agents and needs **no new
  dependencies**. Each provider is a tiny adapter (handshake + audio framing). Outbound calls go
  through `calls.dial()`, using the provider's REST API and a queue job.
- **WebRTC (browser/mobile):** an optional package `@jsango/webrtc`, using `werift` (pure
  TypeScript, no native build) plus a WASM Opus codec. It gives better audio than WebSocket on
  bad networks, plus echo cancellation. It stays out of the core so `jsango` does not get heavier.
  Signaling is one HTTP route (`POST /voice/offer` → SDP answer) behind the same auth
  middleware. For speech-to-speech providers that accept WebRTC directly, an alternative is
  "browser ↔ provider" WebRTC with a short-lived key, while the server joins the same call to run
  tools. This is offered as `transport: 'direct'` where the provider supports it.
- **SIP trunks** (without a provider like Twilio): later, through the WebRTC/RTP package. Not in
  the first release.

## Insights: Usage, Monitoring, Dashboards

One event stream for **text runs and voice calls**, three optional outputs:

1. **Records** (`app.aiInsights({ store: db })`): tables created on first use (same pattern as
   `DatabaseMemoryStore`).
   - `ai_runs`: agent, provider, model, tokens in/out, cost, duration, status, tool calls,
     user/tenant, error.
   - `ai_calls`: transport, from/to, start/end, duration, audio seconds, interruptions, status,
     recording URL.
   - `ai_turns`: per turn: STT ms, LLM first-token ms, TTS first-audio ms, end-to-end ms,
     tokens.
   - **Privacy by default:** no transcript or audio content is stored unless
     `captureContent: true` or `record: true`. Retention is `retentionDays` (a queue job deletes
     old rows and files). Phone numbers can be masked.
2. **Metrics** through `@jsango/observability` (Prometheus): `ai_tokens_total`, `ai_cost_usd_total`,
   `ai_run_duration_seconds`, `voice_turn_latency_seconds{stage}`, `voice_active_calls`,
   `ai_errors_total`.
3. **Admin widgets**: `aiWidgets()` returns ready admin `DashboardWidget`s (usage today, cost
   trend chart, p50/p95 latency chart, active calls, recent errors), plus an "AI Calls" admin page
   with transcript, per-turn latency and a recording player (files in `admin-media` storage).
   Each widget is a normal widget, so developers can pick, reorder, or build their own with
   `insights.query({ from, to, groupBy })`, the same API the widgets use.

**Cost:** a `prices` table (`{ 'openai:gpt-4o-mini': { input, output } }`) supplied by the
app, not hardcoded. Without prices, cost is simply not shown.

---

## Phases

Each phase ships on its own with tests and docs. No phase depends on paid API keys in CI: each
adapter is tested against a fake server, plus opt-in live tests.

| # | Phase | Scope | Size |
| --- | --- | --- | --- |
| 0 | **Token streaming in agents** | `Agent.run()` uses `provider.stream()` when streaming and emits real `message.delta`; `agent.stream()` without polling; tool calls still work. Fixes the documented-but-broken API. | S |
| 1 | **VoiceSession + pipeline mode** | `stt(fn)`, `tts(fn)`, sentence chunking, energy VAD, barge-in with abort, history cut to what was heard, memory used in voice. Refactor the current OpenAI code into a `realtime` adapter. | M |
| 2 | **Adapters** | STT: OpenAI, Deepgram, AssemblyAI, local Whisper (HTTP). TTS: OpenAI, ElevenLabs, Cartesia, local Piper/Kokoro (HTTP). Realtime: OpenAI, Gemini Live. Each is fetch/ws only, with a fake-server test. | M |
| 3 | **Insights** | Event schema, `aiInsights({ store })`, metrics, `prices`, retention, `insights.query()`. | M |
| 4 | **Admin** | `aiWidgets()`, AI Calls page, transcript view, recording player, recordings through `admin-media`. | M |
| 5 | **Phone calling** | μ-law + resampling, Twilio / Telnyx / Plivo transports, `calls.dial()` outbound through the queue, call status webhooks. | M |
| 6 | **WebRTC** | `@jsango/webrtc` (optional): signaling route, Opus, browser client helper; `direct` mode for providers that support it. | L |

Order: 0 → 1 → 2 gives vendor-neutral voice; 3 → 4 gives dashboards; 5 gives calling agents;
6 comes last because it is the heaviest and is optional.

## Decisions to Confirm

1. Which STT/TTS adapters to build first (proposed: Deepgram + Cartesia/ElevenLabs + OpenAI +
   one local option).
2. Which phone provider first (proposed: Twilio, the most common; Telnyx and Plivo after).
3. Is `werift` (pure TypeScript) acceptable as the WebRTC dependency in an optional package?
4. Default retention for records and recordings (proposed: 30 days; content off by default).

## Not Promised

- Exactly-once or durable call recovery after a server crash: an in-progress call ends with the
  process. Records written so far are kept.
- Latency numbers depend on the chosen providers and network. They are measured and shown,
  not guaranteed.
