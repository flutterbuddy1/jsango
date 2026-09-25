import { describe, it, expect } from 'vitest';
import { createTestContext } from './index.js';

describe('@jsango/testing', () => {
  it('should create test context', async () => {
    const ctx = createTestContext();
    expect(ctx).toBeDefined();
    await expect(ctx.reset()).resolves.toBeUndefined();
  });
});
