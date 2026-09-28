import type { ToolContext, ToolDefinition } from '../types.js';
export interface ExecuteToolOptions {
    tool: ToolDefinition;
    arguments: Record<string, unknown>;
    context?: ToolContext | undefined;
    approvalGranted?: boolean | undefined;
}
export interface ToolExecutionResult {
    toolName: string;
    input: Record<string, unknown>;
    output?: unknown | undefined;
    error?: string | undefined;
    durationMs: number;
    approvalRequired?: boolean | undefined;
    approvalId?: string | undefined;
}
export declare class ToolExecutor {
    static execute(options: ExecuteToolOptions): Promise<ToolExecutionResult>;
}
//# sourceMappingURL=tool-executor.d.ts.map