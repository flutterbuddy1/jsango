import type { AgentConfig, ILlmProvider, LlmCallOptions, LlmResponse, LlmStream, MemoryStore, ToolDefinition } from './types.js';
import { Agent } from './agents/agent.js';
import { type CreateToolOptions } from './tools/tool.js';
import { Workflow } from './workflows/workflow.js';
import { KnowledgeBase, type KnowledgeBaseOptions } from './rag/knowledge.js';
import { evaluate } from './evals/evaluator.js';
import { FakeLlmProvider } from './providers/fake-provider.js';
export declare class AiFacade {
    private fakeInstance?;
    generate<T = string>(optionsOrPrompt: LlmCallOptions | string): Promise<LlmResponse<T>>;
    stream(optionsOrPrompt: LlmCallOptions | string): Promise<LlmStream>;
    embed(text: string | string[], options?: {
        model?: string;
    }): Promise<number[][]>;
    agent<T = string>(config: AgentConfig, provider?: ILlmProvider): Agent<T>;
    tool<TInput = any, TOutput = any>(optionsOrName: CreateToolOptions<TInput, TOutput> | string, description?: string, execute?: (input: TInput, ctx: any) => Promise<TOutput> | TOutput): ToolDefinition<TInput, TOutput>;
    workflow(name: string): Workflow;
    knowledge(name: string, options?: Omit<KnowledgeBaseOptions, 'name'>): KnowledgeBase;
    memory(type?: 'memory' | 'database' | 'cache'): MemoryStore;
    evaluate: typeof evaluate;
    mcp: {
        server(options?: import("./mcp/mcp.js").McpServerOptions): import("./mcp/mcp.js").McpServer;
        client: typeof import("./mcp/mcp.js").McpClient;
    };
    registerProvider(name: string, provider: ILlmProvider): this;
    setDefaultModel(model: string): this;
    setFallbacks(models: string[]): this;
    fakeProvider(): FakeLlmProvider;
}
export declare const ai: AiFacade;
//# sourceMappingURL=facade.d.ts.map