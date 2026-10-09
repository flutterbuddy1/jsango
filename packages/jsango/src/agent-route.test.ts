import { describe, it, expect } from 'vitest';
import {
  createApp,
  agent,
  FakeLlmProvider,
  HttpRequest,
  forbidden,
  type RequestContext,
} from './index.js';

const post = async (app: ReturnType<typeof createApp>, body: unknown, headers = {}) => {
  const res = await app.handle(
    new HttpRequest({
      method: 'POST',
      url: 'http://localhost/chat',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    })
  );
  return { status: res.status, json: JSON.parse(String(res.body)) };
};

describe('app.agent', () => {
  it('never returns the history and keeps anonymous visitors apart', async () => {
    const provider = new FakeLlmProvider().respond('first').respond('second');
    const bot = agent({
      name: 'Bot',
      instructions: 'SECRET SYSTEM PROMPT',
      provider,
      memory: true,
    });
    const app = createApp();
    app.agent('/chat', bot);

    const a = await post(app, { input: 'my card is 4242' });
    expect(a.status).toBe(200);
    expect(a.json.text).toBe('first');
    expect(a.json).not.toHaveProperty('messages');
    expect(JSON.stringify(a.json)).not.toContain('SECRET');
    expect(a.json.conversationId).toMatch(/^[0-9a-f-]{36}$/);

    // A second anonymous visitor gets a fresh conversation, not visitor A's.
    const b = await post(app, { input: 'hi' });
    expect(b.json.conversationId).not.toBe(a.json.conversationId);
    const lastPrompt = (provider.callHistory.at(-1)?.messages ?? [])
      .map((m) => m.content)
      .join(' ');
    expect(lastPrompt).not.toContain('4242');
  });

  it('applies middleware and limits input size', async () => {
    const bot = agent({ name: 'Bot', provider: new FakeLlmProvider().respond('ok') });
    const app = createApp();
    app.agent('/chat', bot, {
      maxInputLength: 10,
      middleware: [
        (ctx: RequestContext, next: () => Promise<unknown>) => {
          if (!ctx.request.headers.get('x-user')) throw forbidden();
          return next();
        },
      ],
    });
    expect((await post(app, { input: 'hi' })).status).toBe(403);
    expect((await post(app, { input: 'x'.repeat(11) }, { 'x-user': '1' })).status).toBe(400);
    expect((await post(app, { input: 'hi' }, { 'x-user': '1' })).json.text).toBe('ok');
  });
});
