export type {
  LlmRole,
  LlmToolCall,
  LlmMessage,
  LlmUsage,
  LlmResponse,
  LlmChunk,
  LlmStream,
  ToolDefinition,
  ToolContext,
  LlmCallOptions,
  ILlmProvider,
  GuardrailConfig,
  AgentContext,
  AgentEventType,
  AgentEvent,
  AgentRunOptions,
  AgentApprovalRequest,
  AgentRunResult,
  AgentConfig,
  MemoryStore,
  VectorDocument,
  VectorSearchResult,
  IVectorStore,
  McpToolDefinition,
  EvaluationCase,
  EvaluationResult,
} from './types.js';

export {
  AiError,
  ModelError,
  ProviderError,
  ToolError,
  AgentError,
  WorkflowError,
  ApprovalRequiredError,
  ContextLimitError,
  BudgetExceededError,
  GuardrailViolationError,
} from './errors.js';

export { BaseLlmProvider } from './providers/base-provider.js';
export { OpenAiProvider, type OpenAiProviderOptions } from './providers/openai-provider.js';
export {
  AnthropicProvider,
  type AnthropicProviderOptions,
} from './providers/anthropic-provider.js';
export { GeminiProvider, type GeminiProviderOptions } from './providers/gemini-provider.js';
export { OllamaProvider, type OllamaProviderOptions } from './providers/ollama-provider.js';
export {
  OpenRouterProvider,
  type OpenRouterProviderOptions,
} from './providers/openrouter-provider.js';
export { FakeLlmProvider, type FakeResponseRule } from './providers/fake-provider.js';
export { ModelRouter, type ModelRouterOptions } from './providers/model-router.js';

export { tool, toJsonSchema, type CreateToolOptions } from './tools/tool.js';
export {
  ToolExecutor,
  type ExecuteToolOptions,
  type ToolExecutionResult,
} from './tools/tool-executor.js';

export { Agent, agent, getDefaultRouter, setDefaultRouter } from './agents/agent.js';
export {
  Workflow,
  workflow,
  type StepHandler,
  type WorkflowStepDef,
  type WorkflowResult,
} from './workflows/workflow.js';

export {
  InMemoryMemoryStore,
  DatabaseMemoryStore,
  memory,
  type DatabaseMemoryOptions,
  type MemoryDatabase,
} from './memory/memory.js';
export {
  KnowledgeBase,
  knowledge,
  type IngestOptions,
  type KnowledgeBaseOptions,
} from './rag/knowledge.js';
export { InMemoryVectorStore, cosineSimilarity } from './rag/vector-store.js';

export {
  McpServer,
  McpClient,
  McpConnection,
  mcp,
  MCP_PROTOCOL_VERSION,
  type McpServerOptions,
  type McpConnectOptions,
  type McpStdio,
} from './mcp/mcp.js';
export { evaluate } from './evals/evaluator.js';

export { ai, AiFacade } from './facade.js';
