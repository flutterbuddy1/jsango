import { OpenAiProvider } from './openai-provider.js';

export interface OllamaProviderOptions {
  baseUrl?: string | undefined;
  defaultModel?: string | undefined;
}

export class OllamaProvider extends OpenAiProvider {
  public override readonly name = 'ollama';

  constructor(options: OllamaProviderOptions = {}) {
    let rawBase = options.baseUrl ?? (typeof process !== 'undefined' ? process.env?.OLLAMA_BASE_URL : undefined) ?? 'http://127.0.0.1:11434';
    rawBase = rawBase.trim().replace(/\/+$/, '');
    const baseUrl = rawBase.endsWith('/v1') ? rawBase : `${rawBase}/v1`;

    super({
      apiKey: 'ollama',
      baseUrl,
      defaultModel: options.defaultModel ?? 'llama3.2',
    });
  }
}
