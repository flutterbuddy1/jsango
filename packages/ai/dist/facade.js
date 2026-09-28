import { agent, getDefaultRouter } from './agents/agent.js';
import { tool } from './tools/tool.js';
import { workflow } from './workflows/workflow.js';
import { knowledge } from './rag/knowledge.js';
import { memory } from './memory/memory.js';
import { evaluate } from './evals/evaluator.js';
import { mcp } from './mcp/mcp.js';
import { FakeLlmProvider } from './providers/fake-provider.js';
export class AiFacade {
    fakeInstance;
    async generate(optionsOrPrompt) {
        const router = getDefaultRouter();
        const options = typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;
        const res = await router.generate(options);
        let parsed = undefined;
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
            }
            catch {
                // Leave unparsed if parsing fails
            }
        }
        return {
            ...res,
            parsed: parsed,
        };
    }
    async stream(optionsOrPrompt) {
        const router = getDefaultRouter();
        const options = typeof optionsOrPrompt === 'string' ? { prompt: optionsOrPrompt } : optionsOrPrompt;
        return router.stream(options);
    }
    async embed(text, options) {
        const router = getDefaultRouter();
        return router.embed(text, options);
    }
    agent(config, provider) {
        return agent(config, provider);
    }
    tool(optionsOrName, description, execute) {
        return tool(optionsOrName, description, execute);
    }
    workflow(name) {
        return workflow(name);
    }
    knowledge(name, options) {
        return knowledge(name, options);
    }
    memory(type = 'memory') {
        return memory(type);
    }
    evaluate = evaluate;
    mcp = mcp;
    registerProvider(name, provider) {
        getDefaultRouter().registerProvider(name, provider);
        return this;
    }
    setDefaultModel(model) {
        getDefaultRouter().setDefaultModel(model);
        return this;
    }
    setFallbacks(models) {
        getDefaultRouter().setFallbacks(models);
        return this;
    }
    fakeProvider() {
        if (!this.fakeInstance) {
            this.fakeInstance = new FakeLlmProvider();
            this.registerProvider('fake', this.fakeInstance);
        }
        return this.fakeInstance;
    }
}
export const ai = new AiFacade();
//# sourceMappingURL=facade.js.map