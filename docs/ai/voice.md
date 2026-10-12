# Realtime Voice Agents

`app.voiceAgent()` lets users talk to the same agent you already use for text. It uses the same
instructions and tools, and tools run on your server with the user's permissions. Audio goes
through the **OpenAI Realtime API** (speech-to-speech).

```typescript
import { createApp, agent, tool } from 'jsango';
import { auth } from './auth.js'; // your createAuth({ ... }), see docs/auth

const support = agent({
  instructions: 'You are a friendly support agent. Keep answers short.',
  tools: {
    lookupOrder: tool({
      name: 'lookup_order',
      description: 'Find an order by its id',
      input: { orderId: 'A100' },
      execute: async ({ orderId }) => Order.find(orderId),
    }),
  },
});

const app = createApp();
app.agent('/api/chat', support, { middleware: [auth.required()] }); // text
app.voiceAgent('/voice', support, { middleware: [auth.required()] }); // voice
```

Set `OPENAI_API_KEY` on the server. The key never reaches the browser: the browser talks to your
server, and your server talks to OpenAI.

A complete runnable app with a browser client is in
[examples/voice-agent](../../examples/voice-agent): `pnpm --filter example-voice-agent build`,
then `OPENAI_API_KEY=... node examples/voice-agent/dist/index.js`, and open
http://localhost:3002.

---

## Options

| Option         | Default                  | What it does                                                                             |
| -------------- | ------------------------ | ---------------------------------------------------------------------------------------- |
| `middleware`   | none (public)            | Auth and rate limits, e.g. `[auth.required()]`.                                          |
| `apiKey`       | `OPENAI_API_KEY`         | OpenAI key (server-side only).                                                           |
| `model`        | `gpt-realtime`           | Realtime model.                                                                          |
| `voice`        | `marin`                  | `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`, `marin`, `cedar`. |
| `transcribe`   | `gpt-4o-mini-transcribe` | Model for transcripts of the user's speech, or `false`.                                  |
| `maxSteps`     | 10                       | Tool rounds per user turn.                                                               |
| `maxSessionMs` | 10 minutes               | Hard limit for one session.                                                              |
| `onEvent`      | none                     | Gets every event (logs, metrics, usage).                                                 |
| `url`          | OpenAI                   | Upstream URL (a proxy, or a fake server in tests).                                       |

---

## Protocol (what the browser sends and receives)

Wait for the `ready` event before sending audio.

**Client → server**

- **Binary frames**: microphone audio as PCM16, mono, 24 kHz (up to 256 KB per frame).
- `{ "type": "text", "text": "..." }`: a typed message (interrupts the current reply).
- `{ "type": "interrupt", "playedMs": 1500 }`: the user cut the agent off. `playedMs` is how
  much of the current reply was actually played, so the model only remembers what was heard.

**Server → client**

- **Binary frames**: the agent's audio as PCM16, mono, 24 kHz. Play them in order as they arrive.
- `ready`: the session is configured, start sending audio.
- `speech.started`: the user started talking. **Stop playback now** and send `interrupt`
  with `playedMs`.
- `transcript.delta` `{ role: 'assistant', text }`: the agent's words as they are spoken.
- `transcript` `{ role: 'user' | 'assistant', text }`: a finished transcript.
- `tool.started` / `tool.completed` / `tool.failed` `{ name, durationMs }`.
- `response.done` `{ status, usage, firstAudioMs }`: token usage from OpenAI, and latency from
  the end of the user's speech to the first audio byte.
- `error` `{ error }`: generic messages in production, details in development.

The browser part (microphone capture with an `AudioWorklet`, playback, interruption) is about 100
lines; see [examples/voice-agent/client.html](../../examples/voice-agent/client.html).

---

## How It Behaves

- **Turn detection** happens on OpenAI (`semantic_vad`): the user just talks, no button.
- **Interruption**: when the user talks over the agent, OpenAI cancels the reply. The server drops
  any audio still arriving from that reply, and **never runs tool calls from a cancelled reply**.
- **Tools** run on your server through the same checks as `agent.run()`. Permission failures go
  back to the model as an error. Tools with `requiresApproval` are **not run** from voice; the
  model is told the action needs approval in the app.
- **Lifecycle**: if the client disconnects, the OpenAI session closes. If OpenAI disconnects, the
  client gets an `error` and is closed. Shutting the server down closes both.
- **Memory**: the conversation lives in the OpenAI session for as long as the call lasts. It is not
  saved to the agent's `memory` store.

---

## Why WebSocket (and not WebRTC)

The server sits in the middle, which is what lets tools run in your app with the signed-in
user's permissions, keeps the API key on the server, and lets you log usage. The cost is one extra
network hop. A WebRTC mode, where the browser connects to OpenAI directly with a short-lived key
while the server handles tools, is **not implemented yet**.

## Not Supported Yet

- Providers other than OpenAI (e.g. Gemini Live).
- WebRTC transport, and phone or SIP calls.
- Audio formats other than PCM16 24 kHz (e.g. G.711 for telephony).
- Saving voice transcripts to agent memory automatically. Use `onEvent` with `transcript`
  events to store them yourself.

## Testing

`packages/jsango/src/voice.test.ts` runs the whole flow against a fake Realtime server, so the
normal test suite needs no API key. It covers session setup, audio relay, tool calls, interruption
and truncation, stale replies, malformed audio and disconnects. One live test against the real
API runs when `OPENAI_API_KEY` is set:

```bash
OPENAI_API_KEY=sk-... pnpm vitest run packages/jsango/src/voice.test.ts
```
