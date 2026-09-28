import { JsangoError } from '@jsango/core';
export class AiError extends JsangoError {
    constructor(options) {
        super(options);
    }
}
export class ModelError extends AiError {
    constructor(message, cause, metadata) {
        super({
            code: 'ERR_AI_MODEL',
            message,
            statusCode: 502,
            cause,
            metadata,
        });
    }
}
export class ProviderError extends AiError {
    provider;
    constructor(provider, message, cause, metadata) {
        super({
            code: 'ERR_AI_PROVIDER',
            message: `[${provider}] ${message}`,
            statusCode: 502,
            cause,
            metadata: { ...metadata, provider },
        });
        this.provider = provider;
    }
}
export class ToolError extends AiError {
    toolName;
    constructor(toolName, message, cause, metadata) {
        super({
            code: 'ERR_AI_TOOL',
            message: `Tool '${toolName}' failed: ${message}`,
            statusCode: 500,
            cause,
            metadata: { ...metadata, toolName },
        });
        this.toolName = toolName;
    }
}
export class AgentError extends AiError {
    agentName;
    constructor(agentName, message, cause, metadata) {
        super({
            code: 'ERR_AI_AGENT',
            message: `Agent '${agentName}' failed: ${message}`,
            statusCode: 500,
            cause,
            metadata: { ...metadata, agentName },
        });
        this.agentName = agentName;
    }
}
export class WorkflowError extends AiError {
    workflowName;
    constructor(workflowName, message, cause, metadata) {
        super({
            code: 'ERR_AI_WORKFLOW',
            message: `Workflow '${workflowName}' failed: ${message}`,
            statusCode: 500,
            cause,
            metadata: { ...metadata, workflowName },
        });
        this.workflowName = workflowName;
    }
}
export class ApprovalRequiredError extends AiError {
    approvalId;
    toolName;
    input;
    constructor(approvalId, toolName, input) {
        super({
            code: 'ERR_AI_APPROVAL_REQUIRED',
            message: `Human approval required for tool '${toolName}'. Approval ID: ${approvalId}`,
            statusCode: 403,
            metadata: { approvalId, toolName, input },
        });
        this.approvalId = approvalId;
        this.toolName = toolName;
        this.input = input;
    }
}
export class ContextLimitError extends AiError {
    constructor(message = 'Context window or token limit exceeded', metadata) {
        super({
            code: 'ERR_AI_CONTEXT_LIMIT',
            message,
            statusCode: 400,
            metadata,
        });
    }
}
export class BudgetExceededError extends AiError {
    constructor(message = 'AI cost or token budget exceeded', metadata) {
        super({
            code: 'ERR_AI_BUDGET_EXCEEDED',
            message,
            statusCode: 429,
            metadata,
        });
    }
}
export class GuardrailViolationError extends AiError {
    constructor(message, metadata) {
        super({
            code: 'ERR_AI_GUARDRAIL_VIOLATION',
            message: `Guardrail violation: ${message}`,
            statusCode: 400,
            metadata,
        });
    }
}
//# sourceMappingURL=errors.js.map