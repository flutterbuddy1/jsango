import { detectRuntime } from './runtime.js';
import { NodeRuntimeAdapter } from '../internal/node-adapter.js';
export * from './runtime.js';
export function createRuntimeAdapter() {
    const runtime = detectRuntime();
    if (runtime === 'node') {
        return new NodeRuntimeAdapter();
    }
    // Fallback to NodeRuntimeAdapter for standard Node-compatible environments
    return new NodeRuntimeAdapter();
}
//# sourceMappingURL=index.js.map