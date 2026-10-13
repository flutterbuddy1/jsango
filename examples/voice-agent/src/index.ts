import { readFileSync } from 'node:fs';
import {
  createApp,
  agent,
  tool,
  twilio,
  aiAdminPage,
  recordTo,
  HttpResponse,
  LocalDiskMediaStorage,
  type ILlmProvider,
  type VoiceOptions,
} from 'jsango';
import { llmFromEnv, voiceFromEnv } from './models.js';

/** A tiny order book standing in for your database. */
const ORDERS: Record<string, { item: string; status: string; eta: string }> = {
  A100: { item: 'Mechanical keyboard', status: 'shipped', eta: 'tomorrow' },
  A101: { item: 'USB-C hub', status: 'packed', eta: 'in 3 days' },
  A102: { item: 'Monitor arm', status: 'delivered', eta: 'delivered on Monday' },
};

/** One agent for text and voice: same instructions, tools and memory everywhere. */
export function supportAgent(provider: ILlmProvider) {
  return agent({
    name: 'ShopSupport',
    provider,
    instructions:
      'You are the voice support agent of an online shop. Answer in one or two short, ' +
      'friendly sentences: your answers are spoken aloud. Use the tools for order questions; ' +
      'never invent order details.',
    tools: {
      lookupOrder: tool({
        name: 'lookup_order',
        description: 'Status and delivery estimate of an order, by order id like A100',
        input: { orderId: 'string' },
        execute: async ({ orderId }: { orderId: string }) =>
          ORDERS[orderId.toUpperCase().replace(/\s+/g, '')] ?? { error: `No order ${orderId}` },
      }),
      storeHours: tool({
        name: 'store_hours',
        description: 'When customer support is open',
        execute: async () => ({ weekdays: '9:00–18:00 IST', weekends: 'closed' }),
      }),
    },
    memory: true, // per caller; old tool results aren't re-sent, history stays small
    history: { maxTokens: 2000, summarize: true },
  });
}

export interface ExampleOptions {
  /** Override the models (tests use fakes; by default they come from the environment). */
  llm?: ILlmProvider;
  voice?: VoiceOptions;
}

export function createApplication(options: ExampleOptions = {}) {
  // Same rule as JSango: anything but development/test (including no NODE_ENV) is production.
  const production = !['development', 'test'].includes(process.env['NODE_ENV'] ?? '');
  const { mode, voice } = options.voice ? { mode: 'custom', voice: options.voice } : voiceFromEnv();
  const support = supportAgent(options.llm ?? llmFromEnv());
  const app = createApp();

  // Usage, cost and latency of every run and call (in memory here; pass `store: db` to keep it).
  const insights = app.aiInsights({
    prices: {
      'gpt-4o-mini': { input: 0.15, output: 0.6 },
      'openai-stt': { perMinute: 0.003 },
      'openai-tts': { perMinute: 0.015 },
    },
    captureContent: !production, // transcripts in the admin while developing only
  });

  // Recordings are opt-in (RECORD=1): tell your callers they are recorded.
  const recordings = new LocalDiskMediaStorage({ root: 'recordings', publicUrl: '/media' });
  const voiceOptions: VoiceOptions = {
    ...voice,
    record: process.env['RECORD'] === '1' ? recordTo(recordings) : undefined,
  };

  // In a real app, protect these with auth: { middleware: [auth.required()] }.
  app.agent('/api/chat', support); // text: POST { input }
  app.voiceAgent('/voice', support, voiceOptions); // browser voice over WebSocket
  if (voice.realtime?.webrtc) {
    app.webrtcAgent('/voice/rtc', support, { realtime: voice.realtime }); // browser voice over WebRTC
  }

  // Phone line: set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_NUMBER and PUBLIC_URL, then point
  // your Twilio number's "A call comes in" webhook at POST {PUBLIC_URL}/phone.
  const phone = process.env['TWILIO_ACCOUNT_SID']
    ? app.phoneAgent('/phone', support, {
        ...voiceOptions,
        carrier: twilio({ from: process.env['TWILIO_NUMBER'] }),
        publicUrl: process.env['PUBLIC_URL'],
      })
    : undefined;
  if (phone) {
    // POST /call { "to": "+91..." } places an outbound call. Protect it in a real app.
    app.post('/call', async (ctx) => {
      const { to } = (await ctx.request.json()) as { to?: string };
      if (!to || !/^\+\d{8,15}$/.test(to))
        return HttpResponse.json({ error: 'to: +E.164 number' }, { status: 400 });
      return phone.dial(to);
    });
  }

  // Admin with the "AI Usage" page: runs, calls, cost, latency, transcripts, recordings.
  const adminPassword =
    process.env['ADMIN_PASSWORD'] ?? (production ? undefined : 'change-me-in-dev');
  if (adminPassword) {
    app.admin({
      resources: [],
      credentials: {
        email: process.env['ADMIN_EMAIL'] ?? 'admin@example.com',
        password: adminPassword,
      },
      media: { local: recordings },
      pages: [aiAdminPage(insights)],
    });
  }

  const page = readFileSync(new URL('../client.html', import.meta.url), 'utf8');
  app.get('/', () => HttpResponse.html(page));
  app.get('/config', () => ({
    mode,
    webrtc: Boolean(voice.realtime?.webrtc),
    phone: Boolean(phone),
  }));
  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['PORT']) || 3002;
  await createApplication().listen(port);
  console.log(`Voice agent: http://localhost:${port}  ·  admin: http://localhost:${port}/admin`);
}
