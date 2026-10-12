import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  agent,
  tool,
  provider,
  FakeLlmProvider,
  OpenAiProvider,
  AnthropicProvider,
  type AgentEvent,
} from '../index.js';

afterEach(() => vi.unstubAllGlobals());

/** Stubs fetch with an SSE response made of these `data:` payloads; returns the call count. */
function sse(events: unknown[]) {
  const body = events
    .map((e) => `data: ${typeof e === 'string' ? e : JSON.stringify(e)}\n\n`)
    .join('');
  const fetchMock = vi.fn(async () => new Response(body, { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('agent token streaming', () => {
  it('emits message.delta tokens and the full answer', async () => {
    const bot = agent({ provider: new FakeLlmProvider().respond('hello there world') });
    const deltas: string[] = [];
    let final = '';
    for await (const e of bot.stream('hi')) {
      if (e.type === 'message.delta') deltas.push((e.data as { text: string }).text);
      if (e.type === 'run.completed') final = (e.data as { text: string }).text;
    }
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join('')).toBe('hello there world');
    expect(final).toBe('hello there world');
  });

  it('runs tools while streaming', async () => {
    const fake = new FakeLlmProvider().respondWithTool('add', { a: 2, b: 3 }).respond('5');
    const add = tool({
      name: 'add',
      description: 'Add',
      input: { a: 1, b: 1 },
      execute: async ({ a, b }: { a: number; b: number }) => a + b,
    });
    const types: string[] = [];
    for await (const e of agent({ provider: fake, tools: { add } }).stream('2+3?'))
      types.push(e.type);
    expect(types).toContain('tool.completed');
    expect(types.at(-1)).toBe('run.completed');
  });

  it('cancels the run when the consumer stops early', async () => {
    let aborted = false;
    const slow = provider(
      ({ signal }) =>
        new Promise<string>((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new Error('aborted'));
          });
        })
    );
    for await (const e of agent({}, slow).stream('hi') as AsyncIterable<AgentEvent>) {
      if (e.type === 'message.started') break;
    }
    expect(aborted).toBe(true);
  });
});

describe('provider streams', () => {
  it('OpenAI: joins tool call fragments, reads usage, one request', async () => {
    const fetchMock = sse([
      { choices: [{ delta: { content: 'Checking' } }] },
      {
        choices: [
          {
            delta: {
              tool_calls: [{ index: 0, id: 'c1', function: { name: 'lookup', arguments: '{"or' } }],
            },
          },
        ],
      },
      {
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'der":"42"}' } }] } }],
      },
      { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
      { choices: [], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } },
      '[DONE]',
    ]);
    const stream = await new OpenAiProvider({ apiKey: 'k' }).stream({
      prompt: 'x',
      tools: [{ name: 'lookup', description: 'd' }],
    });
    const deltas: string[] = [];
    for await (const c of stream) if (c.delta) deltas.push(c.delta);
    const res = await stream.toResponse();
    expect(deltas).toEqual(['Checking']);
    expect(res.toolCalls).toEqual([{ id: 'c1', name: 'lookup', arguments: { order: '42' } }]);
    expect(res.usage.totalTokens).toBe(17);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as any)[1].body);
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it('Anthropic: tool_use blocks, input_json_delta and usage', async () => {
    sse([
      { type: 'message_start', message: { usage: { input_tokens: 20 } } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Sure' } },
      {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 't1', name: 'lookup' },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '{"id":' },
      },
      {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: '7}' },
      },
      { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 9 } },
    ]);
    const res = await (
      await new AnthropicProvider({ apiKey: 'k' }).stream({ prompt: 'x' })
    ).toResponse();
    expect(res.text).toBe('Sure');
    expect(res.toolCalls).toEqual([{ id: 't1', name: 'lookup', arguments: { id: 7 } }]);
    expect(res.usage).toEqual({ promptTokens: 20, completionTokens: 9, totalTokens: 29 });
  });
});
