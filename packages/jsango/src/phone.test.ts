import { describe, it, expect, afterEach, vi } from 'vitest';
import { WebSocket } from 'ws';
import {
  createApp,
  agent,
  stt,
  tts,
  twilio,
  twilioSignature,
  mulawEncode,
  mulawDecode,
  FakeLlmProvider,
} from './index.js';

const cleanup: Array<() => unknown> = [];
afterEach(async () => {
  vi.unstubAllGlobals();
  await Promise.all(cleanup.splice(0).map((c) => c()));
});
const until = async (check: () => boolean, ms = 2000) => {
  const end = Date.now() + ms;
  while (!check()) {
    if (Date.now() > end) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

const AUTH = 'twilio-secret';

async function phoneApp(extra: Record<string, unknown> = {}) {
  const app = createApp();
  const spoken: string[] = [];
  const line = app.phoneAgent(
    '/phone',
    agent({ provider: new FakeLlmProvider().respond('Your order shipped.') }),
    {
      carrier: twilio({
        accountSid: 'AC1',
        authToken: AUTH,
        from: '+15550001111',
        apiUrl: 'http://twilio.test',
      }),
      stt: stt(async () => 'where is my order'),
      tts: tts(
        async (text) => {
          spoken.push(text);
          return new Int16Array(1600).fill(3000); // 100 ms at 16 kHz
        },
        { sampleRate: 16000 }
      ),
      ...extra,
    }
  );
  const server = await app.listen(0, '127.0.0.1');
  cleanup.push(() => server.close());
  const base = `http://127.0.0.1:${server.address!.port}`;
  return { line, base, spoken };
}

async function webhook(base: string, form: Record<string, string>, signature?: string) {
  return fetch(`${base}/phone`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-twilio-signature': signature ?? twilioSignature(AUTH, `${base}/phone`, form),
    },
    body: new URLSearchParams(form),
  });
}

/** Plays Twilio's side of a Media Stream. */
function twilioStream(base: string) {
  const ws = new WebSocket(`${base.replace('http', 'ws')}/phone/stream`);
  const received: any[] = [];
  ws.on('message', (raw) => received.push(JSON.parse(raw.toString())));
  const opened = new Promise((r) => ws.once('open', r));
  const closed = new Promise<number>((r) => ws.once('close', (code) => r(code)));
  const send = (m: unknown) => ws.send(JSON.stringify(m));
  const start = (token: string, callSid = 'CA1') =>
    send({
      event: 'start',
      start: {
        streamSid: 'MZ1',
        callSid,
        customParameters: { token },
        mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000 },
      },
      streamSid: 'MZ1',
    });
  const audio = (level: number, frames: number) => {
    for (let i = 0; i < frames; i++)
      send({
        event: 'media',
        streamSid: 'MZ1',
        media: {
          payload: Buffer.from(mulawEncode(new Int16Array(160).fill(level))).toString('base64'),
        },
      });
  };
  return { ws, received, opened, closed, send, start, audio };
}

const tokenOf = (twiml: string) => /name="token" value="([^"]+)"/.exec(twiml)![1]!;

describe('app.phoneAgent (Twilio)', () => {
  it('rejects webhooks without a valid Twilio signature', async () => {
    const { base } = await phoneApp();
    const res = await webhook(base, { CallSid: 'CA1', From: '+1', To: '+2' }, 'forged');
    expect(res.status).toBe(403);
  });

  it('answers a call: TwiML stream, μ-law audio in, the agent speaks back', async () => {
    const { base, spoken } = await phoneApp();
    const res = await webhook(base, { CallSid: 'CA1', From: '+919800000000', To: '+15550001111' });
    expect(res.headers.get('content-type')).toContain('text/xml');
    const twiml = await res.text();
    expect(twiml).toContain(`<Stream url="ws://127.0.0.1:${new URL(base).port}/phone/stream">`);

    const call = twilioStream(base);
    await call.opened;
    call.send({ event: 'connected', protocol: 'Call', version: '1.0.0' });
    call.start(tokenOf(twiml));
    await new Promise((r) => setTimeout(r, 20));
    call.audio(6000, 20); // 400 ms of speech
    call.audio(0, 30); // 600 ms of silence
    await until(() => call.received.some((m) => m.event === 'media'));

    expect(spoken).toEqual(['Your order shipped.']);
    const media = call.received.filter((m) => m.event === 'media');
    expect(media[0].streamSid).toBe('MZ1');
    const pcm = mulawDecode(Buffer.from(media[0].media.payload, 'base64'));
    expect(pcm.length).toBe(800); // 100 ms at 8 kHz
    expect(Math.abs(pcm[10]! - 3000)).toBeLessThan(200);

    call.send({ event: 'stop', streamSid: 'MZ1', stop: { callSid: 'CA1' } });
    expect(await call.closed).toBe(1000);
  });

  it('refuses a stream without a fresh token from this server', async () => {
    const { base } = await phoneApp();
    const call = twilioStream(base);
    await call.opened;
    call.start('made-up');
    expect(await call.closed).toBe(1008);

    // A token is single-use.
    const twiml = await (await webhook(base, { CallSid: 'CA2', From: '+1', To: '+2' })).text();
    const first = twilioStream(base);
    await first.opened;
    first.start(tokenOf(twiml), 'CA2');
    const replay = twilioStream(base);
    await replay.opened;
    replay.start(tokenOf(twiml), 'CA2');
    expect(await replay.closed).toBe(1008);
    first.ws.close();
  });

  it('dials out through the Twilio API and accepts only that call', async () => {
    const { line, base } = await phoneApp({ publicUrl: 'https://voice.example.com' });
    const realFetch = globalThis.fetch;
    const calls: Array<[string, RequestInit]> = [];
    vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
      if (!String(url).startsWith('http://twilio.test')) return realFetch(url, init);
      calls.push([url, init]);
      return Response.json({ sid: 'CA77' }, { status: 201 });
    });

    expect(await line.dial('+919811111111')).toEqual({ callSid: 'CA77' });
    const [url, init] = calls[0]!;
    expect(url).toBe('http://twilio.test/2010-04-01/Accounts/AC1/Calls.json');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(
      `Basic ${Buffer.from(`AC1:${AUTH}`).toString('base64')}`
    );
    const form = new URLSearchParams(String(init.body));
    expect(form.get('To')).toBe('+919811111111');
    expect(form.get('From')).toBe('+15550001111');
    expect(form.get('Twiml')).toContain('<Stream url="wss://voice.example.com/phone/stream">');

    const wrong = twilioStream(base);
    await wrong.opened;
    wrong.start(tokenOf(form.get('Twiml')!), 'CA-other');
    expect(await wrong.closed).toBe(1008);
  });

  it('dial() explains missing configuration', async () => {
    const { line } = await phoneApp();
    await expect(line.dial('+1')).rejects.toThrow(/publicUrl/);
  });
});
