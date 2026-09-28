import type { ILlmProvider, LlmCallOptions, LlmChunk, LlmMessage, LlmResponse, LlmStream } from '../types.js';
export declare abstract class BaseLlmProvider implements ILlmProvider {
    abstract readonly name: string;
    abstract generate(options: LlmCallOptions): Promise<LlmResponse>;
    abstract stream(options: LlmCallOptions): Promise<LlmStream>;
    embed(_text: string | string[], _options?: {
        model?: string;
    }): Promise<number[][]>;
    protected createStream(generator: () => AsyncGenerator<LlmChunk, void, unknown>): LlmStream;
    protected normalizeMessages(messages?: LlmMessage[], prompt?: string, system?: string): LlmMessage[];
}
//# sourceMappingURL=base-provider.d.ts.map