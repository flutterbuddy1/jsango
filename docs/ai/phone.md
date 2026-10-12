# Phone Calling Agents

`app.phoneAgent()` answers and places real phone calls with the same agent and voice setup used
in the browser. It works with any LLM, any speech-to-text and any text-to-speech, or with a
speech-to-speech provider.

```typescript
import { createApp, agent, twilio, deepgram, cartesia } from 'jsango';

const support = agent({ provider: myLlm, instructions: 'You are the phone support line.' });

const app = createApp();
const line = app.phoneAgent('/phone', support, {
  carrier: twilio({ from: '+15550001111' }), // TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN
  publicUrl: 'https://voice.example.com',
  stt: deepgram(),
  tts: cartesia({ voiceId: process.env.CARTESIA_VOICE! }),
});

// Outbound: call someone and connect the agent when they answer.
await line.dial('+919876543210', { params: { orderId: '42' } });
```

**Inbound setup:** in the Twilio console, set your number's _A call comes in_ webhook to
`POST https://voice.example.com/phone`. JSango replies with TwiML that connects a
bidirectional Media Stream to `wss://voice.example.com/phone/stream`.

## Security

- Every webhook is checked against **Twilio's signature** (`X-Twilio-Signature`, signed with your
  auth token) over the public URL. Set `publicUrl` when running behind a proxy or load balancer.
  Without an auth token, production refuses calls (503). Development skips the check.
- A media stream is accepted only with a **single-use token** that this server issued, either for
  the call it just answered (valid 60 s) or the call it just dialed (valid 2 min, and only for that
  call's id). Anyone else who connects to `/phone/stream` is refused.
- Caller numbers aren't trusted as identity. Use `identify` to map a caller to your user (e.g.
  after an OTP or a known-number lookup):

```typescript
app.phoneAgent('/phone', support, {
  carrier: twilio(),
  stt: deepgram(),
  tts: cartesia({ voiceId: process.env.CARTESIA_VOICE! }),
  identify: async (call) => findCustomerByPhone(call.from), // undefined = anonymous caller
});
```

With a user, memory follows the caller across calls. Without one, memory lasts for the call.

## How It Works

- Twilio sends μ-law 8 kHz audio. JSango converts it to PCM16, and resamples to whatever your
  speech-to-text wants. The agent's audio goes back the same way.
- Barge-in works as in the browser. When the caller talks over the agent, Twilio's playback
  buffer is cleared (`clear`), the LLM and speech calls are aborted, and memory keeps what the
  caller heard.
- When the session ends (time limit, error, or the agent's turn limit), the stream closes and
  Twilio hangs up. When the caller hangs up, the session closes.
- `onEvent` receives `call.answered { call }` plus every voice event. Calls show up in
  [AI insights](insights.md) like browser calls.

## Large Volumes of Outbound Calls

`line.dial()` is a plain async function. Run it from a queue job to control concurrency and
retries:

```typescript
jobs.register('call-customer', async (payload: { phone: string; reason: string }) => {
  await line.dial(payload.phone, { params: { reason: payload.reason } });
});

await jobs.dispatch('call-customer', { phone: '+919876543210', reason: 'delivery' });
```

## Not Supported Yet

- Carriers other than Twilio (Telnyx, Plivo, Vonage): their media streams are similar, and a
  carrier is one adapter. Contributions welcome.
- DTMF (keypad) input, call transfer, voicemail detection.
- Recording audio: use Twilio's call recording for now.
