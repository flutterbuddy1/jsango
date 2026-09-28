import { BaseLlmProvider } from './base-provider.js';
export class FakeLlmProvider extends BaseLlmProvider {
    name = 'fake';
    rules = [];
    defaultResponse = 'Hello from JSango Fake AI!';
    callHistory = [];
    constructor(defaultResponse = 'Hello from JSango Fake AI!') {
        super();
        this.defaultResponse = defaultResponse;
    }
    setDefaultResponse(text) {
        this.defaultResponse = text;
        return this;
    }
    respond(rule) {
        if (typeof rule === 'string') {
            this.rules.push({ response: rule });
        }
        else {
            this.rules.push(rule);
        }
        return this;
    }
    respondWithTool(toolName, args, callId = 'call_0') {
        this.rules.push({
            response: '',
            toolCalls: [{ id: callId, name: toolName, arguments: args }],
        });
        return this;
    }
    reset() {
        this.rules.length = 0;
        this.callHistory.length = 0;
    }
    async generate(options) {
        this.callHistory.push(options);
        const resolved = await this.resolveResponse(options);
        return resolved;
    }
    async stream(options) {
        this.callHistory.push(options);
        const resolved = await this.resolveResponse(options);
        const words = (resolved.text || 'Response').split(' ');
        const toolCalls = resolved.toolCalls;
        const generator = async function* () {
            for (const word of words) {
                yield { delta: `${word} ` };
            }
            if (toolCalls) {
                for (const tc of toolCalls) {
                    yield { toolCallDelta: tc };
                }
            }
            yield {
                finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
                usage: resolved.usage,
            };
        };
        return this.createStream(generator);
    }
    async embed(text) {
        const list = Array.isArray(text) ? text : [text];
        return list.map((str) => {
            // Deterministic 8-dimension mock embedding from text hash
            const vec = [0, 0, 0, 0, 0, 0, 0, 0];
            for (let i = 0; i < str.length; i++) {
                const idx = i % 8;
                vec[idx] = (vec[idx] + str.charCodeAt(i)) / 1000;
            }
            // Normalize
            const norm = Math.sqrt(vec.reduce((acc, val) => acc + val * val, 0)) || 1;
            return vec.map((v) => v / norm);
        });
    }
    async resolveResponse(options) {
        // 1. Check rules with explicit match predicate
        for (let i = 0; i < this.rules.length; i++) {
            const rule = this.rules[i];
            if (rule.match) {
                const lastMsg = options.messages?.[options.messages.length - 1]?.content ?? options.prompt ?? '';
                let isMatch = false;
                if (typeof rule.match === 'string') {
                    isMatch = lastMsg.includes(rule.match);
                }
                else if (rule.match instanceof RegExp) {
                    isMatch = rule.match.test(lastMsg);
                }
                else if (typeof rule.match === 'function') {
                    isMatch = rule.match(options);
                }
                if (isMatch) {
                    if (rule.delayMs) {
                        await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
                    }
                    let respContent = typeof rule.response === 'function' ? rule.response(options) : rule.response;
                    if (typeof respContent === 'string') {
                        respContent = { text: respContent };
                    }
                    const text = respContent.text ?? '';
                    const toolCalls = respContent.toolCalls ?? rule.toolCalls;
                    return {
                        text,
                        toolCalls,
                        usage: {
                            promptTokens: 10,
                            completionTokens: text.split(' ').length,
                            totalTokens: 10 + text.split(' ').length,
                            estimatedCostUsd: 0,
                        },
                        finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
                    };
                }
            }
        }
        // 2. FIFO consumption of queued responses without matchers
        if (this.rules.length > 0) {
            const rule = this.rules.shift();
            if (rule.delayMs) {
                await new Promise((resolve) => setTimeout(resolve, rule.delayMs));
            }
            let respContent = typeof rule.response === 'function' ? rule.response(options) : rule.response;
            if (typeof respContent === 'string') {
                respContent = { text: respContent };
            }
            const text = respContent.text ?? '';
            const toolCalls = respContent.toolCalls ?? rule.toolCalls;
            return {
                text,
                toolCalls,
                usage: {
                    promptTokens: 10,
                    completionTokens: text.split(' ').length,
                    totalTokens: 10 + text.split(' ').length,
                    estimatedCostUsd: 0,
                },
                finishReason: toolCalls && toolCalls.length > 0 ? 'tool_calls' : 'stop',
            };
        }
        return {
            text: this.defaultResponse,
            usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15, estimatedCostUsd: 0 },
            finishReason: 'stop',
        };
    }
}
//# sourceMappingURL=fake-provider.js.map