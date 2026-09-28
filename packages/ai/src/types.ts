export type LlmRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LlmMessage {
  role: LlmRole;
  content: string;
  name?: string | undefined;
  toolCallId?: string | undefined;
  toolCalls?: LlmToolCall[] | undefined;
}

export interface LlmUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUsd?: number | undefined;
}

export interface LlmResponse<T = string> {
  text: string;
  parsed?: T | undefined;
  toolCalls?: LlmToolCall[] | undefined;
  usage: LlmUsage;
  finishReason?: string | undefined;
  raw?: unknown | undefined;
}

export interface LlmChunk {
  delta?: string | undefined;
  toolCallDelta?: Partial<LlmToolCall> | undefined;
  finishReason?: string | undefined;
  usage?: LlmUsage | undefined;
}

export interface LlmStream extends AsyncIterable<LlmChunk> {
  toResponse(): Promise<LlmResponse>;
  toTextStream(): AsyncIterable<string>;
}

export interface ToolDefinition<TInput = any, TOutput = any> {
  name: string;
  description: string;
  inputSchema?: any;
  execute(input: TInput, ctx: ToolContext): Promise<TOutput> | TOutput;
  requiresApproval?: boolean | undefined;
  permissions?: string[] | undefined;
  timeoutMs?: number | undefined;
  maxRetries?: number | undefined;
}

export interface ToolContext {
  user?: any | undefined;
  tenantId?: string | undefined;
  conversationId?: string | undefined;
  requestId?: string | undefined;
  signal?: AbortSignal | undefined;
  logger?: any | undefined;
  services?: Record<string, unknown> | undefined;
}

export interface LlmCallOptions {
  model?: string | undefined;
  prompt?: string | undefined;
  messages?: LlmMessage[] | undefined;
  system?: string | undefined;
  temperature?: number | undefined;
  maxTokens?: number | undefined;
  tools?: Array<ToolDefinition | Record<string, any>> | undefined;
  output?: any | undefined;
  signal?: AbortSignal | undefined;
  topP?: number | undefined;
  stop?: string[] | undefined;
}

export interface ILlmProvider {
  readonly name: string;
  generate(options: LlmCallOptions): Promise<LlmResponse>;
  stream(options: LlmCallOptions): Promise<LlmStream>;
  embed?(text: string | string[], options?: { model?: string }): Promise<number[][]>;
}

export interface GuardrailConfig {
  maxExecutionTimeMs?: number | undefined;
  maxTokens?: number | undefined;
  maxCostUsd?: number | undefined;
  inputFilter?: (input: string) => boolean | Promise<boolean>;
  outputFilter?: (output: string) => boolean | Promise<boolean>;
  redactSensitive?: boolean | undefined;
}

export interface AgentContext {
  user?: any | undefined;
  tenantId?: string | undefined;
  conversationId?: string | undefined;
  requestId?: string | undefined;
  signal?: AbortSignal | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export type AgentEventType =
  | 'run.started'
  | 'run.completed'
  | 'run.failed'
  | 'message.started'
  | 'message.delta'
  | 'message.completed'
  | 'tool.started'
  | 'tool.completed'
  | 'tool.failed'
  | 'approval.required'
  | 'approval.resolved'
  | 'workflow.started'
  | 'workflow.step.started'
  | 'workflow.step.completed'
  | 'workflow.completed';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  runId: string;
  data: Record<string, any>;
}

export interface AgentRunOptions {
  input: string;
  context?: AgentContext | undefined;
  signal?: AbortSignal | undefined;
  maxSteps?: number | undefined;
  knowledge?: any | undefined;
  onEvent?: ((event: AgentEvent) => void) | undefined;
}

export interface AgentApprovalRequest {
  approvalId: string;
  toolName: string;
  input: Record<string, unknown>;
  createdAt: number;
}

export interface AgentRunResult<T = string> {
  runId: string;
  text: string;
  output?: T | undefined;
  toolCalls: Array<{ name: string; input: unknown; output: unknown; durationMs: number }>;
  messages: LlmMessage[];
  usage: LlmUsage;
  durationMs: number;
  status: 'completed' | 'paused' | 'failed' | 'cancelled';
  approvalRequest?: AgentApprovalRequest | undefined;
  error?: Error | undefined;
}

export interface AgentConfig {
  name: string;
  model?: string | undefined;
  instructions?: string | ((ctx: AgentContext) => string | Promise<string>) | undefined;
  tools?: Record<string, ToolDefinition | ((...args: any[]) => any)> | undefined;
  memory?: MemoryStore | 'conversation' | 'long-term' | boolean | undefined;
  guardrails?: GuardrailConfig | undefined;
  maxSteps?: number | undefined;
  maxTokens?: number | undefined;
  temperature?: number | undefined;
  onEvent?: ((event: AgentEvent) => void) | undefined;
}

export interface MemoryStore {
  get(key: string): Promise<LlmMessage[]>;
  set(key: string, messages: LlmMessage[]): Promise<void>;
  clear(key: string): Promise<void>;
  search?(query: string, limit?: number): Promise<string[]>;
}

export interface VectorDocument {
  id: string;
  content: string;
  embedding?: number[] | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface VectorSearchResult {
  document: VectorDocument;
  score: number;
}

export interface IVectorStore {
  insert(docs: VectorDocument[]): Promise<void>;
  search(queryEmbedding: number[], limit?: number, minScore?: number): Promise<VectorSearchResult[]>;
  delete(id: string): Promise<void>;
  clear(): Promise<void>;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface EvaluationCase {
  input: string;
  expected?: string | RegExp | ((res: AgentRunResult) => boolean | Promise<boolean>) | undefined;
  expectedTools?: string[] | undefined;
  maxDurationMs?: number | undefined;
  maxCostUsd?: number | undefined;
}

export interface EvaluationResult {
  name: string;
  passed: boolean;
  score: number;
  durationMs: number;
  usage: LlmUsage;
  errors: string[];
}

