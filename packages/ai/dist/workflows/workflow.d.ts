import type { AgentEvent } from '../types.js';
import { Agent } from '../agents/agent.js';
export type StepHandler<TInput = any, TOutput = any> = ((input: TInput, state: Record<string, any>) => Promise<TOutput> | TOutput) | Agent<TOutput>;
export interface WorkflowStepDef {
    name: string;
    type: 'sequential' | 'parallel' | 'branch' | 'loop';
    handler?: StepHandler | undefined;
    parallelHandlers?: Record<string, StepHandler> | undefined;
    condition?: ((state: Record<string, any>) => string | boolean | Promise<string | boolean>) | undefined;
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
    steps: Array<{
        name: string;
        durationMs: number;
        output?: unknown;
        error?: string;
    }>;
}
export declare class Workflow {
    readonly name: string;
    private readonly steps;
    constructor(name: string);
    step<TInput = any, TOutput = any>(name: string, handler: StepHandler<TInput, TOutput>, options?: {
        retries?: number;
        timeoutMs?: number;
    }): this;
    parallel(name: string, handlers: Record<string, StepHandler>): this;
    branch(name: string, condition: (state: Record<string, any>) => string | Promise<string>, branches: Record<string, StepHandler | Workflow>): this;
    loop(name: string, condition: (state: Record<string, any>) => boolean | Promise<boolean>, handler: StepHandler, maxIterations?: number): this;
    execute(initialState?: any, options?: {
        signal?: AbortSignal;
        onEvent?: (event: AgentEvent) => void;
    }): Promise<WorkflowResult>;
    private executeHandler;
}
export declare function workflow(name: string): Workflow;
//# sourceMappingURL=workflow.d.ts.map