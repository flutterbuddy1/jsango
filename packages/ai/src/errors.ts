import { JsangoError, type JsangoErrorOptions } from '@jsango/core';

export class AiError extends JsangoError {
  constructor(options: JsangoErrorOptions) {
    super(options);
  }
}

export class ModelError extends AiError {
  constructor(message: string, cause?: unknown, metadata?: Record<string, unknown>) {
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
  public readonly provider: string;

  constructor(provider: string, message: string, cause?: unknown, metadata?: Record<string, unknown>) {
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
  public readonly toolName: string;

  constructor(toolName: string, message: string, cause?: unknown, metadata?: Record<string, unknown>) {
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
  public readonly agentName: string;

  constructor(agentName: string, message: string, cause?: unknown, metadata?: Record<string, unknown>) {
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
  public readonly workflowName: string;

  constructor(workflowName: string, message: string, cause?: unknown, metadata?: Record<string, unknown>) {
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
  public readonly approvalId: string;
  public readonly toolName: string;
  public readonly input: Record<string, unknown>;

  constructor(approvalId: string, toolName: string, input: Record<string, unknown>) {
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
  constructor(message = 'Context window or token limit exceeded', metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_AI_CONTEXT_LIMIT',
      message,
      statusCode: 400,
      metadata,
    });
  }
}

export class BudgetExceededError extends AiError {
  constructor(message = 'AI cost or token budget exceeded', metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_AI_BUDGET_EXCEEDED',
      message,
      statusCode: 429,
      metadata,
    });
  }
}

export class GuardrailViolationError extends AiError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super({
      code: 'ERR_AI_GUARDRAIL_VIOLATION',
      message: `Guardrail violation: ${message}`,
      statusCode: 400,
      metadata,
    });
  }
}
