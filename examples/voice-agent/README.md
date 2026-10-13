# Voice Agent Example

A shop support agent you can talk to in the browser. It understands speech, looks up orders with a
tool, answers out loud, and stops talking when you interrupt it. All in about 80 lines:
[src/index.ts](src/index.ts).

## Run It

```bash
cd examples/voice-agent
cp .env.example .env      # put your OPENAI_API_KEY in .env
pnpm dev                  # builds and starts with .env
```

Open http://localhost:3002, click **Start**, allow the microphone and ask
_"Where is order A100?"_. Usage, cost and latency are at http://localhost:3002/admin
(`admin@example.com` / `change-me-in-dev`) under **AI Usage**.

## How It Works

[src/index.ts](src/index.ts) has four parts:

1. **Your data**: a small order list, standing in for your database.
2. **A tool** (`lookup_order`): a function the agent can call. `input: { orderId: 'string' }`
   tells the model the parameter's name and type.
3. **The models**: the LLM that thinks, plus speech-to-text and text-to-speech. They are separate,
   so you can mix providers.
4. **The app**: one `agent()` served as text (`app.agent`) and as voice (`app.voiceAgent`).

[client.html](client.html) records the microphone, streams it to `/voice`, plays the answer as it
arrives, and tells the server when you interrupt.

## Use Other Models

Change the lines in part 3:

```typescript
import { AnthropicProvider, deepgram, cartesia, openaiRealtime } from 'jsango';

const llm = new AnthropicProvider(); // any LLM
const voice = { stt: deepgram(), tts: cartesia({ voiceId: 'your-voice-id' }) }; // any speech models
const realtime = { realtime: openaiRealtime() }; // or one speech-to-speech model
```

Your own or self-hosted models are one function each: `stt(fn)`, `tts(fn)`, `provider(fn)`.
See [Voice Agents](../../docs/ai/voice.md).

## Next Steps

- WebRTC and phone calls with the same agent: [Voice Agents](../../docs/ai/voice.md),
  [Phone Calling Agents](../../docs/ai/phone.md).
- Before going live: protect `/api/chat` and `/voice` with auth (`middleware: [auth.required()]`),
  because every call costs money. Keep insights in your database with
  `app.aiInsights({ store: db })`.

## Test

```bash
pnpm vitest run examples/voice-agent
```

The test uses fake models, so it needs no API key.
