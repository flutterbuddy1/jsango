import type {
  ILlmProvider,
  LlmCallOptions,
  LlmChunk,
  LlmMessage,
  LlmResponse,
  LlmStream,
  LlmUsage,
} from '../types.js';

export abstract class BaseLlmProvider implements ILlmProvider {
  public abstract readonly name: string;

  public abstract generate(options: LlmCallOptions): Promise<LlmResponse>;
  public abstract stream(options: LlmCallOptions): Promise<LlmStream>;

  public async embed(_text: string | string[], _options?: { model?: string }): Promise<number[][]> {
    throw new Error(`Embeddings are not implemented for provider '${this.name}'.`);
  }

  /**
   * Wraps a chunk generator. The provider request runs once: iterating and `toResponse()` share
   * it, and `toResponse()` after a full iteration just returns what was collected.
   */
  protected createStream(generator: () => AsyncGenerator<LlmChunk, void, unknown>): LlmStream {
    let text = '';
    let finishReason: string | undefined;
    let usage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const calls = new Map<
      string | number,
      { id: string; name: string; json: string; args?: Record<string, unknown> }
    >();
    let started = false;

    async function* chunks(): AsyncGenerator<LlmChunk, void, unknown> {
      if (started) return;
      started = true;
      for await (const chunk of generator()) {
        if (chunk.delta) text += chunk.delta;
        if (chunk.finishReason) finishReason = chunk.finishReason;
        if (chunk.usage) usage = chunk.usage;
        const d = chunk.toolCallDelta;
        if (d) {
          const key = d.index ?? d.id ?? 0;
          const call = calls.get(key) ?? { id: d.id ?? `call_${calls.size}`, name: '', json: '' };
          if (d.id) call.id = d.id;
          if (d.name) call.name = d.name;
          if (d.argumentsDelta) call.json += d.argumentsDelta;
          if (d.arguments) call.args = d.arguments;
          calls.set(key, call);
        }
        yield chunk;
      }
    }

    const response = (): LlmResponse => {
      const toolCalls = [...calls.values()].map((c) => {
        let args = c.args ?? {};
        if (!c.args && c.json) {
          try {
            args = JSON.parse(c.json);
          } catch {
            // invalid JSON from the model: the tool's own validation reports it
          }
        }
        return { id: c.id, name: c.name, arguments: args };
      });
      return {
        text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage,
        finishReason,
      };
    };

    return {
      [Symbol.asyncIterator]: () => chunks(),
      async toResponse() {
        for await (const _ of chunks()); // eslint-disable-line @typescript-eslint/no-unused-vars
        return response();
      },
      async *toTextStream() {
        for await (const chunk of chunks()) if (chunk.delta) yield chunk.delta;
      },
    };
  }

  protected normalizeMessages(
    messages?: LlmMessage[],
    prompt?: string,
    system?: string
  ): LlmMessage[] {
    const list: LlmMessage[] = [];
    if (system) {
      list.push({ role: 'system', content: system });
    }
    if (messages && messages.length > 0) {
      list.push(...messages);
    }
    if (prompt) {
      list.push({ role: 'user', content: prompt });
    }
    return list;
  }
}

/**
 * The caller's signal plus a timeout: a provider that stops answering must not hold the request
 * (and its connection) forever.
 */
export function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  return anySignal(signal, AbortSignal.timeout(ms));
}

/** Aborts when any of the signals aborts (AbortSignal.any, with a fallback for Node 20.0–20.2). */
export function anySignal(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const list = signals.filter((s): s is AbortSignal => s !== undefined);
  if (list.length === 1) return list[0]!;
  const any = (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (any) return any(list);
  const controller = new AbortController();
  for (const s of list) {
    if (s.aborted) controller.abort(s.reason);
    else s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
  }
  return controller.signal;
}

/** Default limits for a whole model call: plain responses and streams. */
export const GENERATE_TIMEOUT_MS = 120_000;
export const STREAM_TIMEOUT_MS = 600_000;

/**
 * A custom provider from one function: return the reply text, or `{ text, toolCalls, usage }`.
 * `stream()` falls back to one chunk.
 *
 *   const myProvider = provider(async ({ messages, signal }) => callMyModel(messages, signal));
 *
 * Pass `{ embed }` to use it with `knowledge()` (RAG).
 *
 * Talking to an OpenAI-compatible API (Groq, DeepSeek, vLLM, LM Studio...)? Use
 * `new OpenAiProvider({ baseUrl, apiKey })` instead.
 */
export function provider(
  generate: (options: LlmCallOptions) => Promise<string | Partial<LlmResponse>>,
  extra: {
    name?: string;
    embed?: (texts: string[], options?: { model?: string }) => Promise<number[][]>;
  } = {}
): ILlmProvider {
  return new (class extends BaseLlmProvider {
    public readonly name = extra.name ?? 'custom';

    public override async embed(text: string | string[], opts?: { model?: string }) {
      if (!extra.embed) return super.embed(text, opts);
      return extra.embed(Array.isArray(text) ? text : [text], opts);
    }

    public async generate(options: LlmCallOptions): Promise<LlmResponse> {
      // `prompt` / `system` folded into `messages`, so the function only ever reads `messages`.
      const messages = this.normalizeMessages(options.messages, options.prompt, options.system);
      const out = await generate({ ...options, messages, prompt: undefined, system: undefined });
      const res = typeof out === 'string' ? { text: out } : out;
      return {
        ...res,
        text: res.text ?? '',
        usage: res.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      };
    }

    public async stream(options: LlmCallOptions): Promise<LlmStream> {
      const res = await this.generate(options);
      return this.createStream(async function* () {
        if (res.text) yield { delta: res.text };
        for (const tc of res.toolCalls ?? []) yield { toolCallDelta: tc };
        yield { finishReason: res.finishReason ?? 'stop', usage: res.usage };
      });
    }
  })();
}
