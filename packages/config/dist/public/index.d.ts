import type { IRuntimeAdapter } from '@jsango/runtime';
import type { IConfigProvider } from './config.js';
export * from './config.js';
export declare function createConfigProvider(initialValues?: Record<string, unknown>): IConfigProvider;
export declare function createConfigFromRuntime(runtime: IRuntimeAdapter): IConfigProvider;
//# sourceMappingURL=index.d.ts.map