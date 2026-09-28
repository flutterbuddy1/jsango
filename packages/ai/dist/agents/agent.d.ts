import type { AgentConfig, AgentEvent, AgentRunOptions, AgentRunResult, ILlmProvider, ToolDefinition } from '../types.js';
import { ModelRouter } from '../providers/model-router.js';
export declare function getDefaultRouter(): ModelRouter;
export declare function setDefaultRouter(router: ModelRouter): void;
export declare class Agent<TOutput = string> {
    readonly name: string;
    private readonly config;
    private readonly tools;
    private readonly provider;
    private memoryStore?;
    constructor(config: AgentConfig, provider?: ILlmProvider);
    getTools(): ToolDefinition[];
    run(optionsOrInput: AgentRunOptions | string): Promise<AgentRunResult<TOutput>>;
    stream(optionsOrInput: AgentRunOptions | string): AsyncIterable<AgentEvent>;
}
export declare function agent<T = string>(config: AgentConfig, provider?: ILlmProvider): Agent<T>;
//# sourceMappingURL=agent.d.ts.map