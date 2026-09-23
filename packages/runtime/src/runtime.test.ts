import { describe, it, expect } from 'vitest';
import { detectRuntime, createRuntimeAdapter } from './index.js';

describe('@django-js/runtime', () => {
  it('should detect the running runtime', () => {
    const runtime = detectRuntime();
    expect(['node', 'bun', 'unknown']).toContain(runtime);
  });

  it('should instantiate a valid runtime adapter', () => {
    const adapter = createRuntimeAdapter();
    expect(adapter).toBeDefined();
    expect(adapter.name).toBe('node');
    expect(typeof adapter.version).toBe('string');
    expect(typeof adapter.cwd()).toBe('string');
  });

  it('should safely access environment variables through adapter', () => {
    const adapter = createRuntimeAdapter();
    const env = adapter.getAllEnv();
    expect(typeof env).toBe('object');
  });
});
