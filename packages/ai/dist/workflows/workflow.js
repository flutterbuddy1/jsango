import { WorkflowError } from '../errors.js';
import { Agent } from '../agents/agent.js';
export class Workflow {
    name;
    steps = [];
    constructor(name) {
        this.name = name;
    }
    step(name, handler, options) {
        this.steps.push({
            name,
            type: 'sequential',
            handler,
            retries: options?.retries,
            timeoutMs: options?.timeoutMs,
        });
        return this;
    }
    parallel(name, handlers) {
        this.steps.push({
            name,
            type: 'parallel',
            parallelHandlers: handlers,
        });
        return this;
    }
    branch(name, condition, branches) {
        this.steps.push({
            name,
            type: 'branch',
            condition,
            branches,
        });
        return this;
    }
    loop(name, condition, handler, maxIterations = 10) {
        this.steps.push({
            name,
            type: 'loop',
            condition,
            handler,
            maxIterations,
        });
        return this;
    }
    async execute(initialState = {}, options) {
        const startTime = Date.now();
        const state = typeof initialState === 'object' && initialState !== null && !Array.isArray(initialState)
            ? { ...initialState }
            : { input: initialState };
        const stepRecords = [];
        const emit = (type, data) => {
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
            const step = this.steps[sIdx];
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
                    const stepInput = state[step.name] !== undefined
                        ? state[step.name]
                        : sIdx === 0 && state.input !== undefined
                            ? state.input
                            : state;
                    const out = await this.executeHandler(step.handler, stepInput, state, options);
                    state[step.name] = out;
                    stepRecords.push({ name: step.name, output: out, durationMs: Date.now() - stepStart });
                }
                else if (step.type === 'parallel' && step.parallelHandlers) {
                    const keys = Object.keys(step.parallelHandlers);
                    const results = await Promise.all(keys.map((k) => this.executeHandler(step.parallelHandlers[k], state[k] ?? state, state, options)));
                    const parallelOut = {};
                    keys.forEach((k, i) => {
                        parallelOut[k] = results[i];
                        state[k] = results[i];
                    });
                    state[step.name] = parallelOut;
                    stepRecords.push({ name: step.name, output: parallelOut, durationMs: Date.now() - stepStart });
                }
                else if (step.type === 'branch' && step.condition && step.branches) {
                    const branchKey = await step.condition(state);
                    const branchTarget = step.branches[String(branchKey)];
                    if (branchTarget) {
                        let out;
                        if (branchTarget instanceof Workflow) {
                            const subRes = await branchTarget.execute(state, options);
                            out = subRes.state;
                        }
                        else {
                            out = await this.executeHandler(branchTarget, state, state, options);
                        }
                        state[step.name] = out;
                        state[`${step.name}->${branchKey}`] = out;
                        stepRecords.push({ name: `${step.name}->${branchKey}`, output: out, durationMs: Date.now() - stepStart });
                    }
                }
                else if (step.type === 'loop' && step.condition && step.handler) {
                    let iteration = 0;
                    const max = step.maxIterations ?? 10;
                    while (iteration < max && (await step.condition(state))) {
                        iteration++;
                        const loopOut = await this.executeHandler(step.handler, state, state, options);
                        state[`${step.name}_${iteration}`] = loopOut;
                    }
                    stepRecords.push({ name: step.name, output: `Completed ${iteration} iterations`, durationMs: Date.now() - stepStart });
                }
                emit('workflow.step.completed', { step: step.name, output: state[step.name] });
            }
            catch (err) {
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
    async executeHandler(handler, input, state, options) {
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
export function workflow(name) {
    return new Workflow(name);
}
//# sourceMappingURL=workflow.js.map