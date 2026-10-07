import type {
  AgentConfig,
  ILlmProvider,
  LlmCallOptions,
  LlmResponse,
  LlmStream,
  MemoryStore,
  ToolDefinition,
} from './types.js';
import { Agent, agent, getDefaultRouter } from './agents/agent.js';
import { tool, type CreateToolOptions } from './tools/tool.js';
import { Workflow, workflow } from './workflows/workflow.js';
import { KnowledgeBase, knowledge, type KnowledgeBaseOptions } from './rag/knowledge.js';
import { memory, type DatabaseMemoryOptions } from './memory/memory.js';
import { evaluate } from './evals/evaluator.js';
import { mcp } from './mcp/mcp.js';
import { FakeLlmProvider } from './providers/fake-provider.js';

export class AiFacade {
  private fakeInstance?: FakeLlmProvider | undefined;

  public async generate<T = string>(optionsOrPrompt: LlmCallOptions | string): Promise<LlmResponse<T>> {
    const router = getDefaultRouter();
    const options: LlmCallOptions = typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;

    const res = await router.generate(options);
    let parsed: any = undefined;

    // If structured output validation requested
    if (options.output) {
      try {
        if (typeof res.text === 'string') {
          // Attempt JSON extraction from text
          const jsonMatch = res.text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(res.text);
        }
        if (typeof options.output.validate === 'function') {
          const valRes = options.output.validate(parsed);
          if (valRes.valid) {
            parsed = valRes.data;
          }
        }
      } catch {
        // Leave unparsed if parsing fails
      }
    }

    return {
      ...res,
      parsed: parsed as T | undefined,
    };
  }


  public async stream(optionsOrPrompt: LlmCallOptions | string): Promise<LlmStream> {
    const router = getDefaultRouter();
    const options: LlmCallOptions = typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;
    return router.stream(options);
  }

  public async embed(text: string | string[], options?: { model?: string }): Promise<number[][]> {
    const router = getDefaultRouter();
    return router.embed(text, options);
  }

  public agent<T = string>(config: AgentConfig, provider?: ILlmProvider): Agent<T> {
    return agent<T>(config, provider);
  }

  public tool<TInput = any, TOutput = any>(
    optionsOrName: CreateToolOptions<TInput, TOutput> | string,
    description?: string,
    execute?: (input: TInput, ctx: any) => Promise<TOutput> | TOutput
  ): ToolDefinition<TInput, TOutput> {
    return tool<TInput, TOutput>(optionsOrName, description, execute);
  }

  public workflow(name: string): Workflow {
    return workflow(name);
  }

  public knowledge(name: string, options?: Omit<KnowledgeBaseOptions, 'name'>): KnowledgeBase {
    return knowledge(name, options);
  }

  /** `ai.memory()` (in-process) or `ai.memory('database', { connection: db })` (persisted). */
  public memory(type: 'memory' | 'database' = 'memory', options?: DatabaseMemoryOptions): MemoryStore {
    return type === 'database' ? memory('database', options as DatabaseMemoryOptions) : memory();
  }

  public evaluate = evaluate;

  public mcp = mcp;

  public registerProvider(name: string, provider: ILlmProvider): this {
    getDefaultRouter().registerProvider(name, provider);
    return this;
  }

  public setDefaultModel(model: string): this {
    getDefaultRouter().setDefaultModel(model);
    return this;
  }

  public setFallbacks(models: string[]): this {
    getDefaultRouter().setFallbacks(models);
    return this;
  }

  public fakeProvider(): FakeLlmProvider {
    if (!this.fakeInstance) {
      this.fakeInstance = new FakeLlmProvider();
      this.registerProvider('fake', this.fakeInstance);
    }
    return this.fakeInstance;
  }
}

export const ai = new AiFacade();
