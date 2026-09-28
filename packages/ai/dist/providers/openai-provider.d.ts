import { BaseLlmProvider } from './base-provider.js';
import type { LlmCallOptions, LlmResponse, LlmStream } from '../types.js';
export interface OpenAiProviderOptions {
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    organization?: string | undefined;
    defaultModel?: string | undefined;
}
export declare class OpenAiProvider extends BaseLlmProvider {
    readonly name: string;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultModel;
    constructor(options?: OpenAiProviderOptions);
    generate(options: LlmCallOptions): Promise<LlmResponse>;
    stream(options: LlmCallOptions): Promise<LlmStream>;
    embed(text: string | string[], options?: {
        model?: string;
    }): Promise<number[][]>;
    private buildPayload;
}
//# sourceMappingURL=openai-provider.d.ts.map