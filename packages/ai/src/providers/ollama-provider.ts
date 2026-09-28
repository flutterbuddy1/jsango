import { OpenAiProvider } from './openai-provider.js';

export interface OllamaProviderOptions {
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
}

export class OllamaProvider extends OpenAiProvider {
  public override readonly name = 'ollama';

  constructor(options: OllamaProviderOptions = {}) {
    super({
      apiKey: 'ollama',
      baseUrl: options.baseUrl ?? 'http://127.0.0.1:11434/v1',
      defaultModel: options.defaultModel ?? 'llama3.2',
    });
  }
}
