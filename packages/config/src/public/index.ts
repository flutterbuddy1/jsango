import { MemoryConfigProvider } from '../internal/memory-config.js';
import type { IRuntimeAdapter } from '@jsango/runtime';
import type { IConfigProvider } from './config.js';

export * from './config.js';

export function createConfigProvider(initialValues?: Record<string, unknown>): IConfigProvider {
  return new MemoryConfigProvider(initialValues);
}

export function createConfigFromRuntime(runtime: IRuntimeAdapter): IConfigProvider {
  return MemoryConfigProvider.fromRuntime(runtime);
}
