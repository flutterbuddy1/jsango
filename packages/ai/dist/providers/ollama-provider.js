import { OpenAiProvider } from './openai-provider.js';
export class OllamaProvider extends OpenAiProvider {
    name = 'ollama';
    constructor(options = {}) {
        super({
            apiKey: 'ollama',
            baseUrl: options.baseUrl ?? 'http://127.0.0.1:11434/v1',
            defaultModel: options.defaultModel ?? 'llama3.2',
        });
    }
}
//# sourceMappingURL=ollama-provider.js.map