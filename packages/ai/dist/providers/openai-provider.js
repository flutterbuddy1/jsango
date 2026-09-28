import { BaseLlmProvider } from './base-provider.js';
import { ProviderError } from '../errors.js';
export class OpenAiProvider extends BaseLlmProvider {
    name = 'openai';
    apiKey;
    baseUrl;
    defaultModel;
    constructor(options = {}) {
        super();
        this.apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY ?? '' : '');
        this.baseUrl = options.baseUrl ?? 'https://api.openai.com/v1';
        this.defaultModel = options.defaultModel ?? 'gpt-4o';
    }
    async generate(options) {
        const payload = this.buildPayload(options, false);
        try {
            const fetchInit = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${this.apiKey}`,
                },
                body: JSON.stringify(payload),
            };
            if (options.signal)
                fetchInit.signal = options.signal;
            const res = await fetch(`${this.baseUrl}/chat/completions`, fetchInit);
            if (!res.ok) {
                const errorText = await res.text();
                throw new ProviderError('openai', `Request failed with status ${res.status}: ${errorText}`);
            }
            const data = (await res.json());
            const choice = data.choices?.[0];
            const message = choice?.message;
            let toolCalls;
            if (message?.tool_calls && Array.isArray(message.tool_calls)) {
                toolCalls = message.tool_calls.map((tc) => {
                    let args = {};
                    try {
                        args = JSON.parse(tc.function?.arguments ?? '{}');
                    }
                    catch {
                        args = {};
                    }
                    return {
                        id: tc.id ?? 'call_0',
                        name: tc.function?.name ?? '',
                        arguments: args,
                    };
                });
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
        }
        catch (err) {
            if (err instanceof ProviderError)
                throw err;
            throw new ProviderError('openai', err instanceof Error ? err.message : String(err), err);
        }
    }
    async stream(options) {
        const payload = this.buildPayload(options, true);
        const apiKey = this.apiKey;
        const baseUrl = this.baseUrl;
        const generator = async function* () {
            const fetchInit = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify(payload),
            };
            if (options.signal)
                fetchInit.signal = options.signal;
            const res = await fetch(`${baseUrl}/chat/completions`, fetchInit);
            if (!res.ok) {
                const errorText = await res.text();
                throw new ProviderError('openai', `Stream request failed (${res.status}): ${errorText}`);
            }
            if (!res.body)
                return;
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() ?? '';
                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data:'))
                        continue;
                    const dataStr = trimmed.slice(5).trim();
                    if (dataStr === '[DONE]')
                        return;
                    try {
                        const parsed = JSON.parse(dataStr);
                        const choice = parsed.choices?.[0];
                        const delta = choice?.delta;
                        yield {
                            delta: delta?.content ?? '',
                            finishReason: choice?.finish_reason,
                        };
                    }
                    catch {
                        // ignore malformed SSE
                    }
                }
            }
        };
        return this.createStream(generator);
    }
    async embed(text, options) {
        const input = Array.isArray(text) ? text : [text];
        const model = options?.model ?? 'text-embedding-3-small';
        const res = await fetch(`${this.baseUrl}/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify({ model, input }),
        });
        if (!res.ok) {
            throw new ProviderError('openai', `Embedding failed: ${await res.text()}`);
        }
        const json = (await res.json());
        return json.data.map((item) => item.embedding);
    }
    buildPayload(options, isStream) {
        const messages = this.normalizeMessages(options.messages, options.prompt, options.system);
        const model = (options.model?.replace(/^openai:/, '') ?? this.defaultModel);
        const payload = {
            model,
            messages: messages.map((m) => ({
                role: m.role,
                content: m.content,
                name: m.name,
                tool_call_id: m.toolCallId,
                tool_calls: m.toolCalls?.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: {
                        name: tc.name,
                        arguments: JSON.stringify(tc.arguments),
                    },
                })),
            })),
            stream: isStream,
        };
        if (options.temperature !== undefined)
            payload.temperature = options.temperature;
        if (options.maxTokens !== undefined)
            payload.max_tokens = options.maxTokens;
        if (options.topP !== undefined)
            payload.top_p = options.topP;
        if (options.stop)
            payload.stop = options.stop;
        if (options.tools && options.tools.length > 0) {
            payload.tools = options.tools.map((t) => ({
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
//# sourceMappingURL=openai-provider.js.map