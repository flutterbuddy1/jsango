import { readFileSync } from 'node:fs';
import {
  createApp,
  agent,
  tool,
  aiAdminPage,
  HttpResponse,
  OpenAiProvider,
  openaiStt,
  openaiTts,
  type ILlmProvider,
  type VoiceOptions,
} from 'jsango';

// ─── 1. Your data ────────────────────────────────────────────────────────────────────────────
// A tiny order book standing in for your database.
const orders: Record<string, { item: string; status: string; eta: string }> = {
  A100: { item: 'Mechanical keyboard', status: 'shipped', eta: 'tomorrow' },
  A101: { item: 'USB-C hub', status: 'packed', eta: 'in 3 days' },
};

// ─── 2. A tool the agent can call ────────────────────────────────────────────────────────────
const lookupOrder = tool({
  name: 'lookup_order',
  description: 'Find an order by its id, like A100',
  input: { orderId: 'string' }, // parameter name → type
  execute: async ({ orderId }: { orderId: string }) =>
    orders[orderId.toUpperCase()] ?? { error: `No order ${orderId}` },
});

// ─── 3. The models ───────────────────────────────────────────────────────────────────────────
// The LLM that thinks. Any provider works: AnthropicProvider, OllamaProvider, provider(fn)...
const llm: ILlmProvider = new OpenAiProvider({ defaultModel: 'gpt-4o-mini' });

// How the agent hears (speech-to-text) and speaks (text-to-speech). Swap for any provider:
//   { stt: deepgram(), tts: cartesia({ voiceId: '...' }) }
//   { stt: openaiStt(), tts: elevenlabs({ voiceId: '...' }) }
//   { realtime: openaiRealtime() }   ← one speech-to-speech model instead of stt + LLM + tts
const voice: VoiceOptions = { stt: openaiStt(), tts: openaiTts({ voice: 'marin' }) };

// ─── 4. The app ──────────────────────────────────────────────────────────────────────────────
export function createApplication(models = { llm, voice }) {
  // One agent serves both text and voice: same instructions, tools and memory.
  const support = agent({
    name: 'ShopSupport',
    provider: models.llm,
    instructions:
      'You are the support agent of an online shop. Your answers are spoken aloud, so keep ' +
      'them to one or two short sentences. Use lookup_order for order questions.',
    tools: { lookupOrder },
    memory: true,
  });

  const app = createApp();

  app.agent('/api/chat', support); // text:  POST /api/chat { "input": "..." }
  app.voiceAgent('/voice', support, models.voice); // voice: the WebSocket client.html talks to

  // Usage, cost and latency of every chat and call, on an "AI Usage" admin page.
  // (Development only: a real app uses its own users and auth here.)
  const insights = app.aiInsights();
  if (process.env['NODE_ENV'] === 'development') {
    app.admin({
      resources: [],
      credentials: { email: 'admin@example.com', password: 'change-me-in-dev' },
      pages: [aiAdminPage(insights)],
    });
  }

  const page = readFileSync(new URL('../client.html', import.meta.url), 'utf8');
  app.get('/', () => HttpResponse.html(page));
  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  await createApplication().listen(3002);
  console.log('Voice agent: http://localhost:3002  ·  admin: http://localhost:3002/admin');
}
