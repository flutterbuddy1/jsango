import { JsangoError, type JsangoErrorOptions } from '@jsango/core';
export declare class AiError extends JsangoError {
    constructor(options: JsangoErrorOptions);
}
export declare class ModelError extends AiError {
    constructor(message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class ProviderError extends AiError {
    readonly provider: string;
    constructor(provider: string, message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class ToolError extends AiError {
    readonly toolName: string;
    constructor(toolName: string, message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class AgentError extends AiError {
    readonly agentName: string;
    constructor(agentName: string, message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class WorkflowError extends AiError {
    readonly workflowName: string;
    constructor(workflowName: string, message: string, cause?: unknown, metadata?: Record<string, unknown>);
}
export declare class ApprovalRequiredError extends AiError {
    readonly approvalId: string;
    readonly toolName: string;
    readonly input: Record<string, unknown>;
    constructor(approvalId: string, toolName: string, input: Record<string, unknown>);
}
export declare class ContextLimitError extends AiError {
    constructor(message?: string, metadata?: Record<string, unknown>);
}
export declare class BudgetExceededError extends AiError {
    constructor(message?: string, metadata?: Record<string, unknown>);
}
export declare class GuardrailViolationError extends AiError {
    constructor(message: string, metadata?: Record<string, unknown>);
}
//# sourceMappingURL=errors.d.ts.map