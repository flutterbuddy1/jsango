import { BaseLlmProvider } from './base-provider.js';
import type { LlmCallOptions, LlmResponse, LlmStream, LlmToolCall } from '../types.js';
export interface FakeResponseRule {
    match?: string | RegExp | ((options: LlmCallOptions) => boolean) | undefined;
    response: Partial<LlmResponse> | string | ((options: LlmCallOptions) => Partial<LlmResponse> | string);
    toolCalls?: LlmToolCall[] | undefined;
    delayMs?: number | undefined;
}
export declare class FakeLlmProvider extends BaseLlmProvider {
    readonly name = "fake";
    private readonly rules;
    private defaultResponse;
    callHistory: LlmCallOptions[];
    constructor(defaultResponse?: string);
    setDefaultResponse(text: string): this;
    respond(rule: FakeResponseRule | string): this;
    respondWithTool(toolName: string, args: Record<string, unknown>, callId?: string): this;
    reset(): void;
    generate(options: LlmCallOptions): Promise<LlmResponse>;
    stream(options: LlmCallOptions): Promise<LlmStream>;
    embed(text: string | string[]): Promise<number[][]>;
    private resolveResponse;
}
//# sourceMappingURL=fake-provider.d.ts.map