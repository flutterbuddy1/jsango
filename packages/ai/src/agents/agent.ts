import type {
  AgentConfig,
  AgentContext,
  AgentEvent,
  AgentRunOptions,
  AgentRunResult,
  ILlmProvider,
  LlmMessage,
  LlmResponse,
  LlmUsage,
  MemoryStore,
  ToolDefinition,
} from '../types.js';
import { GuardrailViolationError } from '../errors.js';
import { ModelRouter } from '../providers/model-router.js';
import { anySignal } from '../providers/base-provider.js';
import { tool } from '../tools/tool.js';
import { ToolExecutor, type ToolExecutionResult } from '../tools/tool-executor.js';
import { InMemoryMemoryStore, compactHistory } from '../memory/memory.js';

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

  /** The system prompt for this context (static or computed per user). */
  public async instructionsFor(context: AgentContext = {}): Promise<string> {
    const { instructions } = this.config;
    return (typeof instructions === 'function' ? await instructions(context) : instructions) ?? '';
  }

  /**
   * Runs one tool call with the same permission and approval checks as `run()`. Never throws:
   * an unknown tool or a denied permission comes back as `error`.
   */
  public async callTool(
    name: string,
    args: Record<string, unknown>,
    context: AgentContext = {}
  ): Promise<ToolExecutionResult> {
    const target = this.tools.get(name);
    if (!target)
      return { toolName: name, input: args, error: `Tool '${name}' not found.`, durationMs: 0 };
    try {
      return await ToolExecutor.execute({
        tool: target,
        arguments: args,
        context: {
          user: context.user,
          tenantId: context.tenantId,
          conversationId: context.conversationId,
          requestId: context.requestId,
          signal: context.signal,
        },
      });
    } catch (err) {
      return {
        toolName: name,
        input: args,
        error: err instanceof Error ? err.message : String(err),
        durationMs: 0,
      };
    }
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
    let instructions = await this.instructionsFor(context);

    // 3. Prepare messages & memory
    // History is isolated per tenant and user, so two users can never read each other's
    // conversation even if they pick the same conversationId.
    const { memory: storedMemory, key: conversationKey } = this.memoryFor(context);
    const memory = options.saveHistory === false ? undefined : storedMemory;
    // Voice reads history but saves turns itself (only what the caller actually heard).
    const readMemory = storedMemory;
    // The system prompt is rebuilt every run (never stored), so it can't grow turn after turn.
    const maxHistoryTokens = this.config.history?.maxTokens ?? 4000;
    const summarize = Boolean(readMemory && this.config.history?.summarize);
    const summaryKey = `${conversationKey}|summary`;
    const history: LlmMessage[] = readMemory
      ? compactHistory(
          (await readMemory.get(conversationKey)).filter((m) => m.role !== 'system'),
          maxHistoryTokens
        ).kept
      : [];
    let summary = summarize ? ((await readMemory!.get(summaryKey))[0]?.content ?? '') : '';
    const messages: LlmMessage[] = [...history];

    if (summary) instructions += `\n\nSummary of the earlier conversation:\n${summary}`;
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

    const userMessage: LlmMessage = { role: 'user', content: userInput };
    messages.push(userMessage);

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

      const request = {
        model: this.config.model,
        messages,
        tools: toolsList.length > 0 ? toolsList : undefined,
        temperature: this.config.temperature,
        maxTokens: this.config.maxTokens,
        signal: options.signal,
      };
      // Someone is listening (stream(), voice, SSE): stream tokens as they arrive.
      let llmRes: LlmResponse;
      if (options.onEvent) {
        const stream = await this.provider.stream(request);
        for await (const chunk of stream) {
          if (chunk.delta) emit({ type: 'message.delta', data: { text: chunk.delta } });
        }
        llmRes = await stream.toResponse();
      } else {
        llmRes = await this.provider.generate(request);
      }

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
            emit({
              type: 'tool.failed',
              data: {
                toolName: tc.name,
                error: execResult.error,
                durationMs: execResult.durationMs,
              },
            });
          } else {
            emit({
              type: 'tool.completed',
              data: {
                toolName: tc.name,
                output: execResult.output,
                durationMs: execResult.durationMs,
              },
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

    // Save updated memory: the raw question (not the RAG context injected into it), compacted.
    if (memory) {
      const turns = messages
        .filter((m) => m.role !== 'system')
        .map((m) => (m === userMessage ? { ...m, content: options.input } : m));
      await this.saveTurns(memory, conversationKey, turns, summary, usage, options.signal);
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

  /**
   * Where this context's history lives. History is isolated per tenant and user, so two users
   * never read each other's conversation even with the same conversationId. Anonymous callers
   * without a conversationId get no memory (a shared 'default' would mix visitors).
   */
  private memoryFor(context: AgentContext): { memory?: MemoryStore | undefined; key: string } {
    const userId =
      context.user && typeof context.user === 'object'
        ? (context.user as { id?: unknown }).id
        : context.user;
    const hasUser = userId !== undefined && userId !== null;
    const key = [
      context.tenantId !== undefined ? `t:${context.tenantId}` : undefined,
      hasUser ? `u:${String(userId)}` : undefined,
      context.conversationId ?? 'default',
    ]
      .filter((part) => part !== undefined)
      .join('|');
    return { memory: hasUser || context.conversationId ? this.memoryStore : undefined, key };
  }

  /** Compacts and stores history, folding dropped turns into the summary when enabled. */
  private async saveTurns(
    memory: MemoryStore,
    key: string,
    turns: LlmMessage[],
    summary: string,
    usage: LlmUsage,
    signal?: AbortSignal
  ): Promise<void> {
    const { kept, dropped } = compactHistory(turns, this.config.history?.maxTokens ?? 4000);
    if (this.config.history?.summarize && dropped.length > 0) {
      const next = await this.summarize(summary, dropped, usage, signal);
      await memory.set(`${key}|summary`, [{ role: 'user', content: next }]);
    }
    await memory.set(key, kept);
  }

  /** This context's stored history, compacted to the token budget (empty without memory). */
  public async history(context: AgentContext = {}): Promise<LlmMessage[]> {
    const { memory, key } = this.memoryFor(context);
    if (!memory) return [];
    const stored = (await memory.get(key)).filter((m) => m.role !== 'system');
    return compactHistory(stored, this.config.history?.maxTokens ?? 4000).kept;
  }

  /**
   * Appends messages to this context's history (for turns that didn't go through `run()`, e.g. a
   * voice reply the user interrupted: only what they heard is saved).
   */
  public async remember(context: AgentContext, messages: LlmMessage[]): Promise<void> {
    const { memory, key } = this.memoryFor(context);
    if (!memory) return;
    const history = (await memory.get(key)).filter((m) => m.role !== 'system');
    const summary = this.config.history?.summarize
      ? ((await memory.get(`${key}|summary`))[0]?.content ?? '')
      : '';
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    await this.saveTurns(memory, key, [...history, ...messages], summary, usage, context.signal);
  }

  /** Folds dropped turns into the running summary, so long conversations stay small. */
  private async summarize(
    previous: string,
    dropped: LlmMessage[],
    usage: LlmUsage,
    signal?: AbortSignal
  ): Promise<string> {
    const transcript = dropped.map((m) => `${m.role}: ${m.content}`).join('\n');
    const res = await this.provider.generate({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content:
            'Summarize this conversation in under 120 words. Keep names, numbers, decisions and ' +
            'open questions. Reply with the summary only.',
        },
        {
          role: 'user',
          content: previous ? `Earlier summary:\n${previous}\n\n${transcript}` : transcript,
        },
      ],
      maxTokens: 300,
      signal,
    });
    usage.promptTokens += res.usage.promptTokens;
    usage.completionTokens += res.usage.completionTokens;
    usage.totalTokens += res.usage.totalTokens;
    return res.text.trim() || previous;
  }

  /**
   * Runs the agent and yields its events as they happen, including `message.delta` tokens.
   * Stopping early (`break`, or the client disconnecting) cancels the run.
   */
  public async *stream(optionsOrInput: AgentRunOptions | string): AsyncIterable<AgentEvent> {
    const options: AgentRunOptions =
      typeof optionsOrInput === 'string' ? { input: optionsOrInput } : optionsOrInput;
    const stop = new AbortController();
    const queue: AgentEvent[] = [];
    let wake: (() => void) | undefined;
    let done = false;
    let failure: { error: unknown } | undefined;

    const running = this.run({
      ...options,
      signal: anySignal(options.signal, stop.signal),
      onEvent: (event) => {
        queue.push(event);
        options.onEvent?.(event);
        wake?.();
      },
    })
      .catch((error: unknown) => {
        failure = { error };
      })
      .finally(() => {
        done = true;
        wake?.();
      });

    try {
      while (true) {
        while (queue.length > 0) yield queue.shift()!;
        if (done) break;
        await new Promise<void>((resolve) => (wake = resolve));
        wake = undefined;
      }
      if (failure) throw failure.error;
    } finally {
      stop.abort();
      await running;
    }
  }
}

export function agent<T = string>(config: AgentConfig, provider?: ILlmProvider): Agent<T> {
  return new Agent<T>(config, provider);
}
