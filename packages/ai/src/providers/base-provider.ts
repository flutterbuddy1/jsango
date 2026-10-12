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

  protected createStream(generator: () => AsyncGenerator<LlmChunk, void, unknown>): LlmStream {
    const iterable = generator();

    return {
      [Symbol.asyncIterator]() {
        return iterable[Symbol.asyncIterator]();
      },
      async toResponse(): Promise<LlmResponse> {
        let text = '';
        let finishReason: string | undefined;
        let usage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
        const toolCallsMap = new Map<string, { id: string; name: string; argumentsStr: string }>();

        for await (const chunk of generator()) {
          if (chunk.delta) {
            text += chunk.delta;
          }
          if (chunk.finishReason) {
            finishReason = chunk.finishReason;
          }
          if (chunk.usage) {
            usage = chunk.usage;
          }
          if (chunk.toolCallDelta) {
            const id = chunk.toolCallDelta.id ?? 'call_0';
            const existing = toolCallsMap.get(id) ?? {
              id,
              name: chunk.toolCallDelta.name ?? '',
              argumentsStr: '',
            };
            if (chunk.toolCallDelta.name) existing.name = chunk.toolCallDelta.name;
            if (chunk.toolCallDelta.arguments) {
              existing.argumentsStr += JSON.stringify(chunk.toolCallDelta.arguments);
            }
            toolCallsMap.set(id, existing);
          }
        }

        const toolCalls = Array.from(toolCallsMap.values()).map((tc) => {
          let parsedArgs = {};
          try {
            parsedArgs = tc.argumentsStr ? JSON.parse(tc.argumentsStr) : {};
          } catch {
            parsedArgs = {};
          }
          return { id: tc.id, name: tc.name, arguments: parsedArgs };
        });

        return {
          text,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          usage,
          finishReason,
        };
      },
      async *toTextStream(): AsyncIterable<string> {
        for await (const chunk of generator()) {
          if (chunk.delta) {
            yield chunk.delta;
          }
        }
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
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  const any = (AbortSignal as { any?: (signals: AbortSignal[]) => AbortSignal }).any;
  if (any) return any([signal, timeout]);
  const controller = new AbortController();
  for (const s of [signal, timeout]) {
    s.addEventListener('abort', () => controller.abort(s.reason), { once: true });
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
