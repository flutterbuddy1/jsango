import { OpenAiProvider } from './openai-provider.js';
export interface OllamaProviderOptions {
    baseUrl?: string | undefined;
    defaultModel?: string | undefined;
}
export declare class OllamaProvider extends OpenAiProvider {
    readonly name = "ollama";
    constructor(options?: OllamaProviderOptions);
}
//# sourceMappingURL=ollama-provider.d.ts.map