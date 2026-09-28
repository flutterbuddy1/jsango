import { BaseLlmProvider } from './base-provider.js';
import type { LlmCallOptions, LlmResponse, LlmStream } from '../types.js';
export interface GeminiProviderOptions {
    apiKey?: string | undefined;
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
}
export declare class GeminiProvider extends BaseLlmProvider {
    readonly name: string;
    private readonly apiKey;
    private readonly baseUrl;
    private readonly defaultModel;
    constructor(options?: GeminiProviderOptions);
    generate(options: LlmCallOptions): Promise<LlmResponse>;
    stream(options: LlmCallOptions): Promise<LlmStream>;
    private buildPayload;
}
//# sourceMappingURL=gemini-provider.d.ts.map