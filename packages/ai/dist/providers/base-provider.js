export class BaseLlmProvider {
    async embed(_text, _options) {
        throw new Error(`Embeddings are not implemented for provider '${this.name}'.`);
    }
    createStream(generator) {
        const iterable = generator();
        return {
            [Symbol.asyncIterator]() {
                return iterable[Symbol.asyncIterator]();
            },
            async toResponse() {
                let text = '';
                let finishReason;
                let usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
                const toolCallsMap = new Map();
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
                        const existing = toolCallsMap.get(id) ?? { id, name: chunk.toolCallDelta.name ?? '', argumentsStr: '' };
                        if (chunk.toolCallDelta.name)
                            existing.name = chunk.toolCallDelta.name;
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
                    }
                    catch {
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
            async *toTextStream() {
                for await (const chunk of generator()) {
                    if (chunk.delta) {
                        yield chunk.delta;
                    }
                }
            },
        };
    }
    normalizeMessages(messages, prompt, system) {
        const list = [];
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
//# sourceMappingURL=base-provider.js.map