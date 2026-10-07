import { BaseLlmProvider } from './base-provider.js';
import type { LlmCallOptions, LlmChunk, LlmResponse, LlmStream, LlmToolCall } from '../types.js';
import { ProviderError } from '../errors.js';

export interface OpenAiProviderOptions {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  organization?: string | undefined;
  defaultModel?: string | undefined;
  headers?: Record<string, string> | undefined;
}

export class OpenAiProvider extends BaseLlmProvider {
  public override readonly name: string = 'openai';
  protected readonly apiKey: string;
  protected readonly baseUrl: string;
  protected readonly organization?: string | undefined;
  protected readonly defaultModel: string;
  protected readonly customHeaders?: Record<string, string> | undefined;

  constructor(options: OpenAiProviderOptions = {}) {
    super();
    this.apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY ?? '' : '');
    this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
    this.organization = options.organization;
    this.defaultModel = options.defaultModel ?? 'gpt-4o';
    this.customHeaders = options.headers;
  }

  public async generate(options: LlmCallOptions): Promise<LlmResponse> {
    const payload = this.buildPayload(options, false);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
        ...this.customHeaders,
      };
      if (this.organization) {
        headers['OpenAI-Organization'] = this.organization;
      }

      const fetchInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      };
      if (options.signal) fetchInit.signal = options.signal;

      const res = await fetch(`${this.baseUrl}/chat/completions`, fetchInit);

      if (!res.ok) {
        const errorText = await res.text();
        throw new ProviderError(this.name, `Request failed with status ${res.status}: ${errorText}`);
      }

      const data = (await res.json()) as any;
      const choice = data.choices?.[0];
      const message = choice?.message;

      let toolCalls: LlmToolCall[] | undefined;
      if (message?.tool_calls && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
        toolCalls = message.tool_calls.map((tc: any, index: number) => {
          let args = {};
          try {
            if (typeof tc.function?.arguments === 'object' && tc.function?.arguments !== null) {
              args = tc.function.arguments;
            } else if (typeof tc.function?.arguments === 'string') {
              args = JSON.parse(tc.function.arguments);
            }
          } catch {
            args = {};
          }
          return {
            id: tc.id ?? `call_${index}_${Math.random().toString(36).substring(2, 7)}`,
            name: tc.function?.name ?? '',
            arguments: args,
          };
        });
      } else if (options.tools && options.tools.length > 0 && typeof message?.content === 'string') {
        const availableToolNames = options.tools.map((t: any) => t.name).filter(Boolean);
        const extracted = this.extractTextToolCalls(message.content, availableToolNames);
        if (extracted.length > 0) {
          toolCalls = extracted;
        }
      }

      const promptTokens = data.usage?.prompt_tokens ?? 0;
      const completionTokens = data.usage?.completion_tokens ?? 0;
      const totalTokens = data.usage?.total_tokens ?? promptTokens + completionTokens;

      return {
        text: message?.content ?? '',
        toolCalls,
        finishReason: choice?.finish_reason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: (promptTokens * 0.000005) + (completionTokens * 0.000015),
        },
        raw: data,
      };
    } catch (err: unknown) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError(this.name, err instanceof Error ? err.message : String(err), err);
    }
  }

  public async stream(options: LlmCallOptions): Promise<LlmStream> {
    const payload = this.buildPayload(options, true);
    const apiKey = this.apiKey;
    const baseUrl = this.baseUrl;
    const providerName = this.name;
    const customHeaders = this.customHeaders;
    const organization = this.organization;

    const generator = async function* (): AsyncGenerator<LlmChunk, void, unknown> {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...customHeaders,
      };
      if (organization) {
        headers['OpenAI-Organization'] = organization;
      }

      const fetchInit: RequestInit = {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      };
      if (options.signal) fetchInit.signal = options.signal;

      const res = await fetch(`${baseUrl}/chat/completions`, fetchInit);

      if (!res.ok) {
        const errorText = await res.text();
        throw new ProviderError(providerName, `Stream request failed (${res.status}): ${errorText}`);
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
          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') return;

          try {
            const parsed = JSON.parse(dataStr);
            const choice = parsed.choices?.[0];
            const delta = choice?.delta;

            yield {
              delta: delta?.content ?? '',
              finishReason: choice?.finish_reason,
            };
          } catch {
            // ignore malformed SSE
          }
        }
      }
    };

    return this.createStream(generator);
  }

  public override async embed(text: string | string[], options?: { model?: string }): Promise<number[][]> {
    const input = Array.isArray(text) ? text : [text];
    const model = options?.model ?? 'text-embedding-3-small';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
      ...this.customHeaders,
    };
    if (this.organization) {
      headers['OpenAI-Organization'] = this.organization;
    }

    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, input }),
    });

    if (!res.ok) {
      throw new ProviderError(this.name, `Embedding failed: ${await res.text()}`);
    }

    const json = (await res.json()) as any;
    return json.data.map((item: any) => item.embedding);
  }

  private extractTextToolCalls(text: string, toolNames: string[]): LlmToolCall[] {
    const results: LlmToolCall[] = [];

    // 1. Check <tool_call> ... </tool_call>
    const tagRegex = /<tool_call>([\s\S]*?)<\/tool_call>/gi;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(text)) !== null) {
      const content = match[1];
      if (!content) continue;
      try {
        const parsed = JSON.parse(content.trim());
        const name = parsed.name ?? parsed.tool;
        if (toolNames.includes(name)) {
          results.push({
            id: `call_${Math.random().toString(36).substring(2, 7)}`,
            name,
            arguments: parsed.arguments ?? parsed.parameters ?? parsed.input ?? {},
          });
        }
      } catch {}
    }

    // 2. Check ```json ... ``` blocks
    if (results.length === 0) {
      const codeBlockRegex = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/gi;
      while ((match = codeBlockRegex.exec(text)) !== null) {
        const content = match[1];
        if (!content) continue;
        try {
          const parsed = JSON.parse(content.trim());
          const name = parsed.name ?? parsed.tool ?? parsed.function;
          if (toolNames.includes(name)) {
            results.push({
              id: `call_${Math.random().toString(36).substring(2, 7)}`,
              name,
              arguments: parsed.arguments ?? parsed.parameters ?? parsed.input ?? {},
            });
          }
        } catch {}
      }
    }

    // 3. Check toolName({ ... }) function invocation syntax
    if (results.length === 0) {
      for (const name of toolNames) {
        const callRegex = new RegExp(`(?:call:?\\s*)?${name}\\s*\\((\\{[\\s\\S]*?\\})\\)`, 'i');
        const funcMatch = callRegex.exec(text);
        if (funcMatch && funcMatch[1]) {
          try {
            const parsed = JSON.parse(funcMatch[1]);
            results.push({
              id: `call_${Math.random().toString(36).substring(2, 7)}`,
              name,
              arguments: parsed,
            });
          } catch {}
        }
      }
    }

    // 4. Check raw JSON object with "name": "toolName" or "tool": "toolName"
    if (results.length === 0) {
      for (const name of toolNames) {
        const jsonPattern = new RegExp(`\\{[\\s\\S]*?"(?:name|tool|function)"\\s*:\\s*"${name}"[\\s\\S]*?\\}`, 'i');
        const jsonMatch = jsonPattern.exec(text);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            results.push({
              id: `call_${Math.random().toString(36).substring(2, 7)}`,
              name,
              arguments: parsed.arguments ?? parsed.parameters ?? parsed.input ?? {},
            });
          } catch {}
        }
      }
    }

    return results;
  }

  private buildPayload(options: LlmCallOptions, isStream: boolean): Record<string, unknown> {
    const messages = this.normalizeMessages(options.messages, options.prompt, options.system);
    const prefixRegex = new RegExp(`^${this.name}:`, 'i');
    const model = (options.model?.replace(prefixRegex, '') ?? this.defaultModel);

    const payload: Record<string, unknown> = {
      model,
      messages: messages.map((m) => {
        const item: Record<string, unknown> = {
          role: m.role,
          content: m.content ?? '',
        };
        if (m.name) item.name = m.name;
        if (m.toolCallId) item.tool_call_id = m.toolCallId;
        if (m.toolCalls && m.toolCalls.length > 0) {
          item.tool_calls = m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments ?? {}),
            },
          }));
        }
        return item;
      }),
      stream: isStream,
    };

    if (options.temperature !== undefined) payload.temperature = options.temperature;
    if (options.maxTokens !== undefined) payload.max_tokens = options.maxTokens;
    if (options.topP !== undefined) payload.top_p = options.topP;
    if (options.stop) payload.stop = options.stop;

    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools.map((t: any) => ({
        type: 'function',
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema ?? { type: 'object', properties: {} },
        },
      }));
    }

    return payload;
  }
}
