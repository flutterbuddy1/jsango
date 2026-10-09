import {
  BaseLlmProvider,
  withTimeout,
  GENERATE_TIMEOUT_MS,
  STREAM_TIMEOUT_MS,
} from './base-provider.js';
import type { LlmCallOptions, LlmChunk, LlmResponse, LlmStream, LlmToolCall } from '../types.js';
import { ProviderError } from '../errors.js';

export interface AnthropicProviderOptions {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
  anthropicVersion?: string | undefined;
}

export class AnthropicProvider extends BaseLlmProvider {
  public override readonly name: string = 'anthropic';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;
  private readonly anthropicVersion: string;

  constructor(options: AnthropicProviderOptions = {}) {
    super();
    this.apiKey =
      options.apiKey ??
      (typeof process !== 'undefined' ? (process.env?.ANTHROPIC_API_KEY ?? '') : '');
    this.baseUrl = options.baseUrl ?? 'https://api.anthropic.com/v1';
    this.defaultModel = options.defaultModel ?? 'claude-3-5-sonnet-20241022';
    this.anthropicVersion = options.anthropicVersion ?? '2023-06-01';
  }

  public async generate(options: LlmCallOptions): Promise<LlmResponse> {
    const payload = this.buildPayload(options, false);

    try {
      const fetchInit: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'anthropic-version': this.anthropicVersion,
        },
        body: JSON.stringify(payload),
      };
      fetchInit.signal = withTimeout(options.signal, GENERATE_TIMEOUT_MS);

      const res = await fetch(`${this.baseUrl}/messages`, fetchInit);

      if (!res.ok) {
        throw new ProviderError('anthropic', `Request failed (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      let text = '';
      const toolCalls: LlmToolCall[] = [];

      for (const block of data.content ?? []) {
        if (block.type === 'text') {
          text += block.text;
        } else if (block.type === 'tool_use') {
          toolCalls.push({
            id: block.id,
            name: block.name,
            arguments: block.input ?? {},
          });
        }
      }

      const promptTokens = data.usage?.input_tokens ?? 0;
      const completionTokens = data.usage?.output_tokens ?? 0;
      const totalTokens = promptTokens + completionTokens;

      return {
        text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: data.stop_reason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: promptTokens * 0.000003 + completionTokens * 0.000015,
        },
        raw: data,
      };
    } catch (err: unknown) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('anthropic', err instanceof Error ? err.message : String(err), err);
    }
  }

  public async stream(options: LlmCallOptions): Promise<LlmStream> {
    const payload = this.buildPayload(options, true);
    const apiKey = this.apiKey;
    const baseUrl = this.baseUrl;
    const anthropicVersion = this.anthropicVersion;

    const generator = async function* (): AsyncGenerator<LlmChunk, void, unknown> {
      const fetchInit: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': anthropicVersion,
        },
        body: JSON.stringify(payload),
      };
      fetchInit.signal = withTimeout(options.signal, STREAM_TIMEOUT_MS);

      const res = await fetch(`${baseUrl}/messages`, fetchInit);

      if (!res.ok) {
        throw new ProviderError(
          'anthropic',
          `Stream request failed (${res.status}): ${await res.text()}`
        );
      }

      if (!res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const jsonStr = trimmed.slice(5).trim();

          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              yield { delta: event.delta.text };
            } else if (event.type === 'message_delta') {
              yield { finishReason: event.delta?.stop_reason };
            }
          } catch {
            // ignore parse error
          }
        }
      }
    };

    return this.createStream(generator);
  }

  private buildPayload(options: LlmCallOptions, isStream: boolean): Record<string, unknown> {
    const rawMessages = this.normalizeMessages(options.messages, options.prompt);
    let system = options.system;
    const messages: Array<{ role: string; content: any }> = [];

    for (const m of rawMessages) {
      if (m.role === 'system') {
        system = (system ? `${system}\n` : '') + m.content;
      } else if (m.role === 'tool') {
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: m.toolCallId ?? 'call_0',
              content: m.content,
            },
          ],
        });
      } else if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        const content: any[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of m.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.name,
            input: tc.arguments,
          });
        }
        messages.push({ role: 'assistant', content });
      } else {
        messages.push({ role: m.role, content: m.content });
      }
    }

    const model = options.model?.replace(/^anthropic:/, '') ?? this.defaultModel;

    const payload: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options.maxTokens ?? 4096,
      stream: isStream,
    };

    if (system) payload.system = system;
    if (options.temperature !== undefined) payload.temperature = options.temperature;
    if (options.topP !== undefined) payload.top_p = options.topP;
    if (options.stop) payload.stop_sequences = options.stop;

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema ?? { type: 'object', properties: {} },
      }));
    }

    return payload;
  }
}
