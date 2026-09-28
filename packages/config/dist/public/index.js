import { MemoryConfigProvider } from '../internal/memory-config.js';
export * from './config.js';
export function createConfigProvider(initialValues) {
    return new MemoryConfigProvider(initialValues);
}
export function createConfigFromRuntime(runtime) {
    return MemoryConfigProvider.fromRuntime(runtime);
}
//# sourceMappingURL=index.js.map