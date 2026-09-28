import type { ToolContext, ToolDefinition } from '../types.js';
export interface CreateToolOptions<TInput = any, TOutput = any> {
    name: string;
    description: string;
    input?: any | undefined;
    inputSchema?: any | undefined;
    execute: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput;
    requiresApproval?: boolean | undefined;
    permissions?: string[] | undefined;
    timeoutMs?: number | undefined;
    maxRetries?: number | undefined;
}
export declare function tool<TInput = any, TOutput = any>(optionsOrName: CreateToolOptions<TInput, TOutput> | string, description?: string, execute?: (input: TInput, ctx: ToolContext) => Promise<TOutput> | TOutput): ToolDefinition<TInput, TOutput>;
/**
 * Converts JSango validation schema objects or standard objects into JSON Schema format
 */
export declare function toJsonSchema(schemaDef: any): Record<string, unknown>;
//# sourceMappingURL=tool.d.ts.map