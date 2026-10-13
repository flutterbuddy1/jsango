import { describe, it, expect, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { FakeLlmProvider, HttpRequest, stt, tts } from 'jsango';
import { createApplication } from './index.js';

// Fake models: no API keys needed. The LLM calls lookup_order, then answers.
function fakeModels() {
  return {
    llm: new FakeLlmProvider()
      .respondWithTool('lookup_order', { orderId: 'A100' })
      .respond('Your keyboard shipped and arrives tomorrow.'),
    voice: {
      stt: stt(async () => 'where is order A100'),
      tts: tts(async () => new Int16Array(1600), { sampleRate: 16000 }),
    },
  };
}

const servers: Array<{ close(): Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((s) => s.close()));
});

const until = async (check: () => boolean) => {
  for (let i = 0; i < 300 && !check(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(check()).toBe(true);
};

describe('voice agent example', () => {
  it('answers a spoken question using the order tool', async () => {
    const server = await createApplication(fakeModels()).listen(0, '127.0.0.1');
    servers.push(server);
    const ws = new WebSocket(`ws://127.0.0.1:${server.address!.port}/voice`);
    const events: any[] = [];
    let audioBytes = 0;
    ws.on('message', (data, isBinary) => {
      if (isBinary) audioBytes += (data as Buffer).length;
      else events.push(JSON.parse(data.toString()));
    });
    await until(() => events.some((e) => e.type === 'ready'));

    // 400 ms of "speech", then 600 ms of silence: the turn ends and the agent answers.
    const speech = Buffer.from(new Int16Array(480).fill(6000).buffer);
    for (let i = 0; i < 20; i++) ws.send(speech);
    for (let i = 0; i < 30; i++) ws.send(Buffer.alloc(960));
    await until(() => events.some((e) => e.type === 'response.done'));

    const transcript = events.filter((e) => e.type === 'transcript').map((e) => e.text);
    expect(transcript).toEqual([
      'where is order A100',
      'Your keyboard shipped and arrives tomorrow.',
    ]);
    expect(events.find((e) => e.type === 'tool.completed')?.name).toBe('lookup_order');
    expect(audioBytes).toBeGreaterThan(0);
    ws.close();
  });

  it('answers text chat with the same agent', async () => {
    const app = createApplication(fakeModels());
    const res = await app.handle(
      new HttpRequest({
        method: 'POST',
        url: 'http://localhost/api/chat',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: 'Where is order A100?' }),
      })
    );
    const chat = JSON.parse(String(res.body));
    expect(chat.text).toBe('Your keyboard shipped and arrives tomorrow.');
    expect(chat.toolCalls.map((t: { name: string }) => t.name)).toEqual(['lookup_order']);
  });
});
