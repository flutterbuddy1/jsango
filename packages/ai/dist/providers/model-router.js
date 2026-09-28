import { ModelError, ProviderError } from '../errors.js';
import { OpenAiProvider } from './openai-provider.js';
import { AnthropicProvider } from './anthropic-provider.js';
import { GeminiProvider } from './gemini-provider.js';
import { OllamaProvider } from './ollama-provider.js';
import { FakeLlmProvider } from './fake-provider.js';
export class ModelRouter {
    name = 'router';
    providers = new Map();
    defaultProviderName;
    defaultModelName;
    fallbacks;
    maxRetries;
    constructor(options = {}) {
        this.defaultProviderName = options.defaultProvider ?? 'openai';
        this.defaultModelName = options.defaultModel ?? 'openai:gpt-4o';
        this.fallbacks = options.fallbacks ?? [];
        this.maxRetries = options.maxRetries ?? 2;
        // Register default providers
        this.registerProvider('openai', new OpenAiProvider());
        this.registerProvider('anthropic', new AnthropicProvider());
        this.registerProvider('gemini', new GeminiProvider());
        this.registerProvider('ollama', new OllamaProvider());
        this.registerProvider('fake', new FakeLlmProvider());
    }
    registerProvider(name, provider) {
        this.providers.set(name.toLowerCase(), provider);
        return this;
    }
    getProvider(name) {
        const p = this.providers.get(name.toLowerCase());
        if (!p) {
            throw new ProviderError(name, `Provider '${name}' is not registered in AI runtime.`);
        }
        return p;
    }
    setDefaultModel(model) {
        this.defaultModelName = model;
        return this;
    }
    setFallbacks(models) {
        this.fallbacks = [...models];
        return this;
    }
    async generate(options) {
        const modelsToTry = this.resolveModelChain(options.model);
        let lastError;
        for (const model of modelsToTry) {
            const { provider, modelName } = this.parseModelString(model);
            const callOpts = { ...options, model: modelName };
            for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
                try {
                    return await provider.generate(callOpts);
                }
                catch (err) {
                    lastError = err;
                    // Only retry if not abort signal
                    if (options.signal?.aborted) {
                        throw err;
                    }
                    if (attempt < this.maxRetries) {
                        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 200));
                    }
                }
            }
        }
        throw new ModelError(`All model attempts failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`, lastError);
    }
    async stream(options) {
        const model = options.model ?? this.defaultModelName;
        const { provider, modelName } = this.parseModelString(model);
        return provider.stream({ ...options, model: modelName });
    }
    async embed(text, options) {
        const model = options?.model ?? this.defaultModelName;
        const { provider, modelName } = this.parseModelString(model);
        if (!provider.embed) {
            throw new ProviderError(provider.name, `Provider '${provider.name}' does not support embeddings.`);
        }
        return provider.embed(text, { model: modelName });
    }
    resolveModelChain(requestedModel) {
        const primary = requestedModel ?? this.defaultModelName;
        const chain = [primary];
        for (const fb of this.fallbacks) {
            if (fb !== primary && !chain.includes(fb)) {
                chain.push(fb);
            }
        }
        return chain;
    }
    parseModelString(modelString) {
        const str = modelString ?? this.defaultModelName;
        const colonIndex = str.indexOf(':');
        if (colonIndex > 0) {
            const providerKey = str.substring(0, colonIndex).toLowerCase();
            const rawModel = str.substring(colonIndex + 1);
            const provider = this.getProvider(providerKey);
            return { provider, modelName: rawModel };
        }
        // Default provider mapping
        const provider = this.getProvider(this.defaultProviderName);
        return { provider, modelName: str };
    }
}
//# sourceMappingURL=model-router.js.map