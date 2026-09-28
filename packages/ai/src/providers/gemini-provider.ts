import { BaseLlmProvider } from './base-provider.js';
import type { LlmCallOptions, LlmChunk, LlmResponse, LlmStream, LlmToolCall } from '../types.js';
import { ProviderError } from '../errors.js';

export interface GeminiProviderOptions {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
}

export class GeminiProvider extends BaseLlmProvider {
  public override readonly name: string = 'gemini';
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultModel: string;

  constructor(options: GeminiProviderOptions = {}) {
    super();
    this.apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY ?? '' : '');
    this.baseUrl = options.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = options.defaultModel ?? 'gemini-1.5-flash';
  }

  public async generate(options: LlmCallOptions): Promise<LlmResponse> {
    const model = (options.model?.replace(/^gemini:/, '') ?? this.defaultModel);
    const payload = this.buildPayload(options);

    try {
      const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;
      const fetchInit: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };
      if (options.signal) fetchInit.signal = options.signal;

      const res = await fetch(url, fetchInit);

      if (!res.ok) {
        throw new ProviderError('gemini', `Request failed (${res.status}): ${await res.text()}`);
      }

      const data = (await res.json()) as any;
      const candidate = data.candidates?.[0];
      let text = '';
      const toolCalls: LlmToolCall[] = [];

      for (const part of candidate?.content?.parts ?? []) {
        if (part.text) {
          text += part.text;
        } else if (part.functionCall) {
          toolCalls.push({
            id: `call_${Math.random().toString(36).substring(2, 9)}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args ?? {},
          });
        }
      }

      const promptTokens = data.usageMetadata?.promptTokenCount ?? 0;
      const completionTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
      const totalTokens = data.usageMetadata?.totalTokenCount ?? promptTokens + completionTokens;

      return {
        text,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason: candidate?.finishReason,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCostUsd: (promptTokens * 0.00000035) + (completionTokens * 0.00000105),
        },
        raw: data,
      };
    } catch (err: unknown) {
      if (err instanceof ProviderError) throw err;
      throw new ProviderError('gemini', err instanceof Error ? err.message : String(err), err);
    }
  }

  public async stream(options: LlmCallOptions): Promise<LlmStream> {
    const model = (options.model?.replace(/^gemini:/, '') ?? this.defaultModel);
    const payload = this.buildPayload(options);
    const apiKey = this.apiKey;
    const baseUrl = this.baseUrl;

    const generator = async function* (): AsyncGenerator<LlmChunk, void, unknown> {
      const url = `${baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;
      const fetchInit: RequestInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      };
      if (options.signal) fetchInit.signal = options.signal;

      const res = await fetch(url, fetchInit);


      if (!res.ok) {
        throw new ProviderError('gemini', `Stream request failed (${res.status}): ${await res.text()}`);
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
            const parsed = JSON.parse(jsonStr);
            const candidate = parsed.candidates?.[0];
            const part = candidate?.content?.parts?.[0];
            if (part?.text) {
              yield { delta: part.text };
            }
          } catch {
            // ignore
          }
        }
      }
    };

    return this.createStream(generator);
  }

  private buildPayload(options: LlmCallOptions): Record<string, unknown> {
    const rawMessages = this.normalizeMessages(options.messages, options.prompt);
    const contents: Array<{ role: string; parts: any[] }> = [];

    for (const m of rawMessages) {
      if (m.role === 'system') {
        // System instruction handled in systemInstruction below
      } else {
        const role = m.role === 'assistant' ? 'model' : 'user';
        const parts: any[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            parts.push({ functionCall: { name: tc.name, args: tc.arguments } });
          }
        }
        contents.push({ role, parts });
      }
    }

    const payload: Record<string, unknown> = {
      contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: options.prompt ?? '' }] }],
    };

    if (options.system) {
      payload.systemInstruction = {
        parts: [{ text: options.system }],
      };
    }

    const generationConfig: Record<string, unknown> = {};
    if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
    if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens;
    if (options.topP !== undefined) generationConfig.topP = options.topP;
    if (options.stop) generationConfig.stopSequences = options.stop;
    if (Object.keys(generationConfig).length > 0) payload.generationConfig = generationConfig;

    if (options.tools && options.tools.length > 0) {
      payload.tools = [
        {
          functionDeclarations: options.tools.map((t: any) => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema,
          })),
        },
      ];
    }

    return payload;
  }
}
