import { detectRuntime, type IRuntimeAdapter } from './runtime.js';
import { NodeRuntimeAdapter } from '../internal/node-adapter.js';

export * from './runtime.js';

export function createRuntimeAdapter(): IRuntimeAdapter {
  const runtime = detectRuntime();
  if (runtime === 'node') {
    return new NodeRuntimeAdapter();
  }
  // Fallback to NodeRuntimeAdapter for standard Node-compatible environments
  return new NodeRuntimeAdapter();
}
