import type {
  AgentConfig,
  AgentContext,
  AgentEvent,
  AgentRunOptions,
  AgentRunResult,
  ILlmProvider,
  LlmMessage,
  LlmUsage,
  MemoryStore,
  ToolDefinition,
} from '../types.js';
import { GuardrailViolationError } from '../errors.js';
import { ModelRouter } from '../providers/model-router.js';
import { tool } from '../tools/tool.js';
import { ToolExecutor } from '../tools/tool-executor.js';
import { InMemoryMemoryStore } from '../memory/memory.js';

let defaultRouter: ModelRouter | null = null;

export function getDefaultRouter(): ModelRouter {
  if (!defaultRouter) {
    defaultRouter = new ModelRouter();
  }
  return defaultRouter;
}

export function setDefaultRouter(router: ModelRouter): void {
  defaultRouter = router;
}

export class Agent<TOutput = string> {
  public readonly name: string;
  private readonly config: AgentConfig;
  private readonly tools = new Map<string, ToolDefinition>();
  private readonly provider: ILlmProvider;
  private memoryStore?: MemoryStore | undefined;

  constructor(config: AgentConfig, provider?: ILlmProvider) {
    this.name = config.name ?? 'agent';
    this.config = config;
    this.provider = provider ?? config.provider ?? getDefaultRouter();

    // Register tools
    if (config.tools) {
      for (const [key, val] of Object.entries(config.tools)) {
        if (typeof val === 'function' && !(val as any).execute) {
          this.tools.set(key, tool(key, `Execute ${key}`, val));
        } else {
          this.tools.set((val as ToolDefinition).name ?? key, val as ToolDefinition);
        }
      }
    }

    // Initialize Memory
    if (config.memory) {
      if (typeof config.memory === 'object') {
        this.memoryStore = config.memory;
      } else {
        this.memoryStore = new InMemoryMemoryStore();
      }
    }
  }

  public getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public async run(optionsOrInput: AgentRunOptions | string): Promise<AgentRunResult<TOutput>> {
    const options: AgentRunOptions =
      typeof optionsOrInput === 'string' ? { input: optionsOrInput } : optionsOrInput;
    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const startTime = Date.now();
    const context: AgentContext = options.context ?? {};
    const maxSteps = options.maxSteps ?? this.config.maxSteps ?? 10;
    const toolCallRecords: Array<{
      name: string;
      input: unknown;
      output: unknown;
      durationMs: number;
    }> = [];

    const emit = (event: Omit<AgentEvent, 'timestamp' | 'runId'>) => {
      const fullEvent: AgentEvent = {
        ...event,
        timestamp: Date.now(),
        runId,
      };
      if (options.onEvent) options.onEvent(fullEvent);
      if (this.config.onEvent) this.config.onEvent(fullEvent);
    };

    emit({ type: 'run.started', data: { agent: this.name, input: options.input } });

    // 1. Guardrail input validation
    if (this.config.guardrails?.inputFilter) {
      const allowed = await this.config.guardrails.inputFilter(options.input);
      if (!allowed) {
        emit({ type: 'run.failed', data: { error: 'Input blocked by guardrail' } });
        throw new GuardrailViolationError('Input message rejected by content guardrails.');
      }
    }

    // 2. Resolve instructions
    let instructions = '';
    if (typeof this.config.instructions === 'function') {
      instructions = await this.config.instructions(context);
    } else if (this.config.instructions) {
      instructions = this.config.instructions;
    }

    // 3. Prepare messages & memory
    // History is isolated per tenant and user, so two users can never read each other's
    // conversation even if they pick the same conversationId.
    const userId =
      context.user && typeof context.user === 'object'
        ? (context.user as { id?: unknown }).id
        : context.user;
    const hasUser = userId !== undefined && userId !== null;
    const conversationKey = [
      context.tenantId !== undefined ? `t:${context.tenantId}` : undefined,
      hasUser ? `u:${String(userId)}` : undefined,
      context.conversationId ?? 'default',
    ]
      .filter((part) => part !== undefined)
      .join('|');
    // Anonymous callers without a conversationId get no memory: one shared 'default' conversation
    // would show every visitor the others' messages.
    const memory = hasUser || context.conversationId ? this.memoryStore : undefined;
    // The system prompt is rebuilt every run (never stored), so it can't grow turn after turn.
    const history: LlmMessage[] = memory
      ? (await memory.get(conversationKey)).filter((m) => m.role !== 'system')
      : [];
    const messages: LlmMessage[] = [...history];

    if (instructions) {
      messages.unshift({ role: 'system', content: instructions });
    }

    // Knowledge / RAG context injection
    let userInput = options.input;
    if (options.knowledge && typeof options.knowledge.retrieve === 'function') {
      const retrieved = await options.knowledge.retrieve(options.input);
      if (retrieved && retrieved.length > 0) {
        userInput = `Context knowledge:\n${retrieved.join('\n\n')}\n\nUser Question: ${options.input}`;
      }
    }

    messages.push({ role: 'user', content: userInput });

    const toolsList = this.getTools();

    // Enhance system prompt with available tools so models on Ollama/OpenRouter know their exact signatures
    if (toolsList.length > 0) {
      const toolDescriptions = toolsList
        .map((t) => {
          const props = t.inputSchema?.properties
            ? Object.entries(t.inputSchema.properties)
                .map(([k, v]: [string, any]) => `${k}: ${v?.type ?? 'string'}`)
                .join(', ')
            : '';
          return `- ${t.name}(${props}): ${t.description}`;
        })
        .join('\n');

      const toolPrompt = `\n\n[AVAILABLE TOOLS]\nYou have access to the following tools:\n${toolDescriptions}\nWhen the user request requires data or actions from these tools, invoke the appropriate tool.`;

      if (messages.length > 0 && messages[0]?.role === 'system') {
        messages[0].content += toolPrompt;
      } else {
        messages.unshift({ role: 'system', content: (instructions || '') + toolPrompt });
      }
    }

    const usage: LlmUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    let currentStep = 0;
    let finalAnswer = '';

    while (currentStep < maxSteps) {
      currentStep++;

      // Check cancellation
      if (options.signal?.aborted) {
        emit({ type: 'run.failed', data: { error: 'Execution cancelled by signal' } });
        return {
          runId,
          text: '',
          toolCalls: toolCallRecords,
          messages,
          usage,
          durationMs: Date.now() - startTime,
          status: 'cancelled',
        };
      }

      // Check execution time guardrails
      if (this.config.guardrails?.maxExecutionTimeMs) {
        if (Date.now() - startTime > this.config.guardrails.maxExecutionTimeMs) {
          throw new GuardrailViolationError(
            `Agent exceeded maximum execution time of ${this.config.guardrails.maxExecutionTimeMs}ms`
          );
        }
      }

      emit({ type: 'message.started', data: { step: currentStep } });

      const llmRes = await this.provider.generate({
        model: this.config.model,
        messages,
        tools: toolsList.length > 0 ? toolsList : undefined,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        signal: options.signal,
      });

      usage.promptTokens += llmRes.usage.promptTokens;
      usage.completionTokens += llmRes.usage.completionTokens;
      usage.totalTokens += llmRes.usage.totalTokens;

      if (llmRes.text) {
        emit({ type: 'message.completed', data: { text: llmRes.text } });
      }

      // If LLM returned tool calls
      if (llmRes.toolCalls && llmRes.toolCalls.length > 0) {
        messages.push({
          role: 'assistant',
          content: llmRes.text,
          toolCalls: llmRes.toolCalls,
        });

        for (const tc of llmRes.toolCalls) {
          const targetTool = this.tools.get(tc.name);
          if (!targetTool) {
            messages.push({
              role: 'tool',
              toolCallId: tc.id,
              name: tc.name,
              content: JSON.stringify({ error: `Tool '${tc.name}' not found.` }),
            });
            continue;
          }

          emit({ type: 'tool.started', data: { toolName: tc.name, input: tc.arguments } });

          const execResult = await ToolExecutor.execute({
            tool: targetTool,
            arguments: tc.arguments,
            context: {
              user: context.user,
              tenantId: context.tenantId,
              conversationId: context.conversationId,
              requestId: context.requestId,
              signal: options.signal,
            },
          });

          // Check if human approval required
          if (execResult.approvalRequired) {
            emit({
              type: 'approval.required',
              data: {
                approvalId: execResult.approvalId!,
                toolName: tc.name,
                input: tc.arguments,
              },
            });

            return {
              runId,
              text: llmRes.text,
              toolCalls: toolCallRecords,
              messages,
              usage,
              durationMs: Date.now() - startTime,
              status: 'paused',
              approvalRequest: {
                approvalId: execResult.approvalId!,
                toolName: tc.name,
                input: tc.arguments,
                createdAt: Date.now(),
              },
            };
          }

          toolCallRecords.push({
            name: tc.name,
            input: tc.arguments,
            output: execResult.output ?? execResult.error,
            durationMs: execResult.durationMs,
          });

          if (execResult.error) {
            emit({ type: 'tool.failed', data: { toolName: tc.name, error: execResult.error } });
          } else {
            emit({
              type: 'tool.completed',
              data: { toolName: tc.name, output: execResult.output },
            });
          }

          messages.push({
            role: 'tool',
            toolCallId: tc.id,
            name: tc.name,
            content: JSON.stringify(execResult.output ?? { error: execResult.error }),
          });
        }
      } else {
        // Final response
        finalAnswer = llmRes.text;
        messages.push({ role: 'assistant', content: finalAnswer });
        break;
      }
    }

    // Save updated memory
    if (memory) {
      await memory.set(
        conversationKey,
        messages.filter((m) => m.role !== 'system')
      );
    }

    emit({ type: 'run.completed', data: { text: finalAnswer, usage } });

    return {
      runId,
      text: finalAnswer,
      output: finalAnswer as unknown as TOutput,
      toolCalls: toolCallRecords,
      messages,
      usage,
      durationMs: Date.now() - startTime,
      status: 'completed',
    };
  }

  public async *stream(optionsOrInput: AgentRunOptions | string): AsyncIterable<AgentEvent> {
    const events: AgentEvent[] = [];
    const options: AgentRunOptions =
      typeof optionsOrInput === 'string' ? { input: optionsOrInput } : optionsOrInput;

    const streamPromise = this.run({
      ...options,
      onEvent: (evt) => {
        events.push(evt);
        if (options.onEvent) options.onEvent(evt);
      },
    });

    let index = 0;
    while (true) {
      while (index < events.length) {
        yield events[index++]!;
      }
      const isDone = await Promise.race([
        streamPromise.then(() => true),
        new Promise<boolean>((r) => setTimeout(() => r(false), 20)),
      ]);
      if (isDone) {
        while (index < events.length) {
          yield events[index++]!;
        }
        break;
      }
    }
  }
}

export function agent<T = string>(config: AgentConfig, provider?: ILlmProvider): Agent<T> {
  return new Agent<T>(config, provider);
}
