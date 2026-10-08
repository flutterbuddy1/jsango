import type { AgentEvent } from '../types.js';
import { WorkflowError } from '../errors.js';
import { Agent } from '../agents/agent.js';

export type StepHandler<TInput = any, TOutput = any> =
  ((input: TInput, state: Record<string, any>) => Promise<TOutput> | TOutput) | Agent<TOutput>;

export interface WorkflowStepDef {
  name: string;
  type: 'sequential' | 'parallel' | 'branch' | 'loop';
  handler?: StepHandler | undefined;
  parallelHandlers?: Record<string, StepHandler> | undefined;
  condition?:
    ((state: Record<string, any>) => string | boolean | Promise<string | boolean>) | undefined;
  branches?: Record<string, StepHandler | Workflow> | undefined;
  maxIterations?: number | undefined;
  retries?: number | undefined;
  timeoutMs?: number | undefined;
}

export interface WorkflowResult {
  workflowName: string;
  status: 'completed' | 'failed';
  state: Record<string, any>;
  durationMs: number;
  steps: Array<{ name: string; durationMs: number; output?: unknown; error?: string }>;
}

export class Workflow {
  public readonly name: string;
  private readonly steps: WorkflowStepDef[] = [];

  constructor(name: string) {
    this.name = name;
  }

  public step<TInput = any, TOutput = any>(
    name: string,
    handler: StepHandler<TInput, TOutput>,
    options?: { retries?: number; timeoutMs?: number }
  ): this {
    this.steps.push({
      name,
      type: 'sequential',
      handler,
      retries: options?.retries,
      timeoutMs: options?.timeoutMs,
    });
    return this;
  }

  public parallel(name: string, handlers: Record<string, StepHandler>): this {
    this.steps.push({
      name,
      type: 'parallel',
      parallelHandlers: handlers,
    });
    return this;
  }

  /**
   * Runs one of `branches`, chosen by the key `condition` returns. A boolean result picks the
   * `true` / `false` branch: `.branch('review', (s) => s.risky, { true: legalAgent, false: fastAgent })`.
   */
  public branch(
    name: string,
    condition: (state: Record<string, any>) => string | boolean | Promise<string | boolean>,
    branches: Record<string, StepHandler | Workflow>
  ): this {
    this.steps.push({
      name,
      type: 'branch',
      condition,
      branches,
    });
    return this;
  }

  public loop(
    name: string,
    condition: (state: Record<string, any>) => boolean | Promise<boolean>,
    handler: StepHandler,
    maxIterations = 10
  ): this {
    this.steps.push({
      name,
      type: 'loop',
      condition,
      handler,
      maxIterations,
    });
    return this;
  }

  /** Alias of execute(), matching `agent.run()`. */
  public run(
    initialState: any = {},
    options?: { signal?: AbortSignal; onEvent?: (event: AgentEvent) => void }
  ): Promise<WorkflowResult> {
    return this.execute(initialState, options);
  }

  public async execute(
    initialState: any = {},
    options?: { signal?: AbortSignal; onEvent?: (event: AgentEvent) => void }
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    const state: Record<string, any> =
      typeof initialState === 'object' && initialState !== null && !Array.isArray(initialState)
        ? { ...initialState }
        : { input: initialState };
    const stepRecords: Array<{
      name: string;
      durationMs: number;
      output?: unknown;
      error?: string;
    }> = [];

    const emit = (type: any, data: any) => {
      if (options?.onEvent) {
        options.onEvent({
          type,
          timestamp: Date.now(),
          runId: `wf_${this.name}`,
          data,
        });
      }
    };

    emit('workflow.started', { workflow: this.name, initialState });

    for (let sIdx = 0; sIdx < this.steps.length; sIdx++) {
      const step = this.steps[sIdx]!;

      if (options?.signal?.aborted) {
        return {
          workflowName: this.name,
          status: 'failed',
          state,
          durationMs: Date.now() - startTime,
          steps: stepRecords,
        };
      }

      const stepStart = Date.now();
      emit('workflow.step.started', { step: step.name });

      try {
        if (step.type === 'sequential') {
          const stepInput =
            state[step.name] !== undefined
              ? state[step.name]
              : sIdx === 0 && state.input !== undefined
                ? state.input
                : state;
          const out = await this.executeHandler(step.handler!, stepInput, state, options);
          state[step.name] = out;
          stepRecords.push({ name: step.name, output: out, durationMs: Date.now() - stepStart });
        } else if (step.type === 'parallel' && step.parallelHandlers) {
          const keys = Object.keys(step.parallelHandlers);
          const results = await Promise.all(
            keys.map((k) =>
              this.executeHandler(step.parallelHandlers![k]!, state[k] ?? state, state, options)
            )
          );
          const parallelOut: Record<string, any> = {};
          keys.forEach((k, i) => {
            parallelOut[k] = results[i];
            state[k] = results[i];
          });
          state[step.name] = parallelOut;
          stepRecords.push({
            name: step.name,
            output: parallelOut,
            durationMs: Date.now() - stepStart,
          });
        } else if (step.type === 'branch' && step.condition && step.branches) {
          const branchKey = await step.condition(state);
          const branchTarget = step.branches[String(branchKey)];
          if (branchTarget) {
            let out: any;
            if (branchTarget instanceof Workflow) {
              const subRes = await branchTarget.execute(state, options);
              out = subRes.state;
            } else {
              out = await this.executeHandler(branchTarget, state, state, options);
            }
            state[step.name] = out;
            state[`${step.name}->${branchKey}`] = out;
            stepRecords.push({
              name: `${step.name}->${branchKey}`,
              output: out,
              durationMs: Date.now() - stepStart,
            });
          }
        } else if (step.type === 'loop' && step.condition && step.handler) {
          let iteration = 0;
          const max = step.maxIterations ?? 10;
          while (iteration < max && (await step.condition(state))) {
            iteration++;
            const loopOut = await this.executeHandler(step.handler, state, state, options);
            state[`${step.name}_${iteration}`] = loopOut;
          }
          stepRecords.push({
            name: step.name,
            output: `Completed ${iteration} iterations`,
            durationMs: Date.now() - stepStart,
          });
        }

        emit('workflow.step.completed', { step: step.name, output: state[step.name] });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        stepRecords.push({ name: step.name, error: errorMsg, durationMs: Date.now() - stepStart });
        emit('workflow.step.completed', { step: step.name, error: errorMsg });
        throw new WorkflowError(this.name, `Step '${step.name}' failed: ${errorMsg}`, err);
      }
    }

    emit('workflow.completed', { workflow: this.name, state });

    return {
      workflowName: this.name,
      status: 'completed',
      state,
      durationMs: Date.now() - startTime,
      steps: stepRecords,
    };
  }

  private async executeHandler(
    handler: StepHandler,
    input: any,
    state: Record<string, any>,
    options?: any
  ): Promise<any> {
    if (handler instanceof Agent) {
      const res = await handler.run({
        input: typeof input === 'string' ? input : JSON.stringify(input),
        signal: options?.signal,
      });
      return res.output ?? res.text;
    }
    return handler(input, state);
  }
}

export function workflow(name: string): Workflow {
  return new Workflow(name);
}
