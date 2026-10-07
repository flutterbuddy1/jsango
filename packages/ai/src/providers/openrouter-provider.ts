import { OpenAiProvider } from './openai-provider.js';

export interface OpenRouterProviderOptions {
  apiKey?: string | undefined;
  baseUrl?: string | undefined;
  siteUrl?: string | undefined;
  siteName?: string | undefined;
  defaultModel?: string | undefined;
}

export class OpenRouterProvider extends OpenAiProvider {
  public override readonly name = 'openrouter';

  constructor(options: OpenRouterProviderOptions = {}) {
    const apiKey = options.apiKey ?? (typeof process !== 'undefined' ? process.env?.OPENROUTER_API_KEY ?? '' : '');
    const headers: Record<string, string> = {};

    if (options.siteUrl) {
      headers['HTTP-Referer'] = options.siteUrl;
    }
    if (options.siteName) {
      headers['X-Title'] = options.siteName;
    }

    super({
      apiKey,
      baseUrl: options.baseUrl ?? 'https://openrouter.ai/api/v1',
      defaultModel: options.defaultModel ?? 'meta-llama/llama-3.3-70b-instruct',
      headers,
    });
  }
}
