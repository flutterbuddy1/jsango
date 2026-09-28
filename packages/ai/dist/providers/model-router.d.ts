import type { ILlmProvider, LlmCallOptions, LlmResponse, LlmStream } from '../types.js';
export interface ModelRouterOptions {
    defaultProvider?: string | undefined;
    defaultModel?: string | undefined;
    fallbacks?: string[] | undefined;
    maxRetries?: number | undefined;
}
export declare class ModelRouter implements ILlmProvider {
    readonly name = "router";
    private readonly providers;
    private defaultProviderName;
    private defaultModelName;
    private fallbacks;
    private maxRetries;
    constructor(options?: ModelRouterOptions);
    registerProvider(name: string, provider: ILlmProvider): this;
    getProvider(name: string): ILlmProvider;
    setDefaultModel(model: string): this;
    setFallbacks(models: string[]): this;
    generate(options: LlmCallOptions): Promise<LlmResponse>;
    stream(options: LlmCallOptions): Promise<LlmStream>;
    embed(text: string | string[], options?: {
        model?: string;
    }): Promise<number[][]>;
    private resolveModelChain;
    parseModelString(modelString?: string): {
        provider: ILlmProvider;
        modelName: string;
    };
}
//# sourceMappingURL=model-router.d.ts.map