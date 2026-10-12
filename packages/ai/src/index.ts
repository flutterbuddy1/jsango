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

export { BaseLlmProvider, provider } from './providers/base-provider.js';
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

// Voice: one session engine, pluggable speech-to-text / text-to-speech / speech-to-speech.
export {
  VoiceSession,
  type VoiceOptions,
  type VoiceOutput,
  type VoiceSessionInit,
} from './voice/session.js';
export {
  stt,
  tts,
  type Stt,
  type SttResult,
  type Tts,
  type RealtimeAdapter,
  type RealtimeConnection,
  type RealtimeEvent,
  type VoiceEvent,
  type VoiceUsage,
  type TurnLatency,
} from './voice/types.js';
export { openaiRealtime, type OpenAiRealtimeOptions } from './voice/openai-realtime.js';
export {
  resample,
  mulawDecode,
  mulawEncode,
  pcmFromBytes,
  pcmToBytes,
  durationMs,
  wav,
} from './voice/audio.js';
export { sentences } from './voice/chunker.js';
export { EnergyVad, type VadOptions } from './voice/vad.js';
export { geminiLive, type GeminiLiveOptions } from './voice/gemini-live.js';
export {
  openaiStt,
  openaiTts,
  elevenlabs,
  cartesia,
  deepgram,
  type OpenAiSttOptions,
  type OpenAiTtsOptions,
  type ElevenLabsOptions,
  type CartesiaOptions,
  type DeepgramOptions,
} from './voice/providers.js';

// Insights: usage, cost, latency, calls.
export { observeAi, type AiRecord } from './insights/events.js';
export {
  Insights,
  createInsights,
  type InsightsOptions,
  type InsightsSummary,
  type Prices,
  type TimeRange,
} from './insights/insights.js';
export { MemoryInsightsStore, SqlInsightsStore, type InsightsStore } from './insights/store.js';
