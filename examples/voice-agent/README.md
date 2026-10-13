# Voice Agent Example

A shop support agent you can talk to: in the browser, over WebRTC, or on a phone call. It looks up
orders with a tool, remembers the conversation, and shows usage, cost, latency and transcripts in
the admin. Every model comes from `.env`, so the same app runs on OpenAI, Anthropic, Ollama,
Deepgram, Cartesia, ElevenLabs, Gemini, or your own self-hosted models.

## Run It

```bash
pnpm install
pnpm --filter example-voice-agent build
cp examples/voice-agent/.env.example examples/voice-agent/.env   # add your OPENAI_API_KEY
cd examples/voice-agent && pnpm start
```

`pnpm start` and `pnpm dev` (build + start) both read `.env`. Running `node dist/index.js`
directly does not, so the API keys are missing.

Open http://localhost:3002, click **Start**, allow the microphone and ask
_"Where is order A100?"_. Talk over the agent to interrupt it. Usage and calls are at
http://localhost:3002/admin (`admin@example.com` / `change-me-in-dev` in development) under
**AI Usage**.

## Choose Your Models

| `.env`                    | What runs                                                                                      | Keys                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `VOICE=openai` (default)  | OpenAI speech-to-text → your LLM → OpenAI text-to-speech                                       | `OPENAI_API_KEY`                                              |
| `VOICE=deepgram-cartesia` | Deepgram (streaming, fast end-of-turn) → your LLM → Cartesia                                   | `DEEPGRAM_API_KEY`, `CARTESIA_API_KEY`, `CARTESIA_VOICE_ID`   |
| `VOICE=elevenlabs`        | OpenAI speech-to-text → your LLM → ElevenLabs                                                  | `OPENAI_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` |
| `VOICE=local`             | Self-hosted OpenAI-compatible servers (e.g. faster-whisper-server + Kokoro-FastAPI) → your LLM | none                                                          |
| `VOICE=realtime`          | OpenAI speech-to-speech; also shows a **Start (WebRTC)** button                                | `OPENAI_API_KEY`                                              |
| `VOICE=gemini`            | Gemini Live speech-to-speech                                                                   | `GEMINI_API_KEY`, `GEMINI_LIVE_MODEL`                         |

The LLM ("your LLM" above) is `LLM=openai` (default), `anthropic` or `ollama`, plus an optional
`LLM_MODEL`. `LLM=ollama` with `VOICE=local` runs fully on your machine.

To use any other provider, change one line in [src/models.ts](src/models.ts): `provider(fn)`
for an LLM, `stt(fn)` / `tts(fn)` for speech.

## What It Shows

| File                                   |                                                                                                                                                                                    |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [src/index.ts](src/index.ts)           | One agent (tools + memory) served as text (`app.agent`), browser voice (`app.voiceAgent`), WebRTC (`app.webrtcAgent`) and phone (`app.phoneAgent`); insights and the admin AI page |
| [src/models.ts](src/models.ts)         | Picking the LLM and voice models from the environment                                                                                                                              |
| [client.html](client.html)             | Browser client: microphone capture, streaming playback, interruptions, WebRTC                                                                                                      |
| [src/index.test.ts](src/index.test.ts) | The whole flow with fake models, no keys needed: `pnpm vitest run examples/voice-agent`                                                                                            |

## Phone Calls (optional)

Set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_NUMBER` and `PUBLIC_URL` (an https URL
that reaches this server, e.g. a tunnel). Then:

1. Point your Twilio number's **A call comes in** webhook at `POST {PUBLIC_URL}/phone` and call
   it.
2. Or have the agent call someone:

   ```bash
   curl -X POST localhost:3002/call -H 'content-type: application/json' -d '{"to":"+91XXXXXXXXXX"}'
   ```

## Before Production

- Put `middleware: [auth.required()]` on `/api/chat`, `/voice`, `/voice/rtc` and `/call`: every
  call costs money.
- Set `ADMIN_PASSWORD` (the admin is not mounted in production without it), and pass
  `store: db` to `app.aiInsights()` so records survive restarts.
- `RECORD=1` records calls to `./recordings`: tell your callers.
