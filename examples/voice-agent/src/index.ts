import { readFileSync } from 'node:fs';
import { createApp, agent, tool, HttpResponse, openaiRealtime } from 'jsango';

// One agent: the same instructions and tools work for text (app.agent) and voice (app.voiceAgent).
export const support = agent({
  name: 'Support',
  model: 'openai:gpt-4o-mini',
  instructions: 'You are a friendly support agent for an online shop. Keep answers short.',
  tools: {
    lookupOrder: tool({
      name: 'lookup_order',
      description: 'Find an order by its id',
      input: { orderId: 'A100' },
      execute: async ({ orderId }: { orderId: string }) => ({
        orderId,
        status: 'shipped',
        eta: 'tomorrow',
      }),
    }),
  },
});

export function createApplication() {
  const app = createApp();
  // In a real app, protect both with auth: { middleware: [auth.required()] }.
  app.agent('/api/chat', support);
  app.voiceAgent('/voice', support, { realtime: openaiRealtime() });
  const page = readFileSync(new URL('../client.html', import.meta.url), 'utf8');
  app.get('/', () => HttpResponse.html(page));
  return app;
}

if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['PORT']) || 3002;
  await createApplication().listen(port);
  console.log(`Voice agent: open http://localhost:${port} and click Start.`);
}
