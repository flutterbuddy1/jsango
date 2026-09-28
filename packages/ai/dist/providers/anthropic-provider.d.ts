import { BaseLlmProvider } from './base-provider.js';
import type { LlmCallOptions, LlmResponse, LlmStream } from '../types.js';
export interface AnthropicProviderOptions {
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
    anthropicVersion?: string | undefined;
}
export declare class AnthropicProvider extends BaseLlmProvider {
    readonly name: string;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultModel;
    private readonly anthropicVersion;
    constructor(options?: AnthropicProviderOptions);
    generate(options: LlmCallOptions): Promise<LlmResponse>;
    stream(options: LlmCallOptions): Promise<LlmStream>;
    private buildPayload;
}
//# sourceMappingURL=anthropic-provider.d.ts.map