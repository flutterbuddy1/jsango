import { describe, it, expect } from 'vitest';
import { RetryCalculator } from '../public/retry.js';
import type { RetryPolicy } from '../public/types.js';

describe('RetryCalculator', () => {
  it('should accurately determine shouldRetry based on attempt and maxAttempts', () => {
    expect(RetryCalculator.shouldRetry(1, 3)).toBe(true);
    expect(RetryCalculator.shouldRetry(2, 3)).toBe(true);
    expect(RetryCalculator.shouldRetry(3, 3)).toBe(false);
    expect(RetryCalculator.shouldRetry(4, 3)).toBe(false);
  });

  it('should compute fixed backoff delay', () => {
    const policy: RetryPolicy = {
      maxAttempts: 5,
      backoffType: 'fixed',
      initialDelayMs: 2000,
      jitter: false,
    };

    expect(RetryCalculator.calculateDelay(policy, 1)).toBe(2000);
    expect(RetryCalculator.calculateDelay(policy, 2)).toBe(2000);
    expect(RetryCalculator.calculateDelay(policy, 3)).toBe(2000);
  });

  it('should compute exponential backoff delay', () => {
    const policy: RetryPolicy = {
      maxAttempts: 5,
      backoffType: 'exponential',
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      jitter: false,
    };

    expect(RetryCalculator.calculateDelay(policy, 1)).toBe(1000); // 1000 * 2^0
    expect(RetryCalculator.calculateDelay(policy, 2)).toBe(2000); // 1000 * 2^1
    expect(RetryCalculator.calculateDelay(policy, 3)).toBe(4000); // 1000 * 2^2
    expect(RetryCalculator.calculateDelay(policy, 4)).toBe(8000); // 1000 * 2^3
    expect(RetryCalculator.calculateDelay(policy, 5)).toBe(10000); // capped at maxDelayMs
  });

  it('should apply jitter within expected bounds', () => {
    const policy: RetryPolicy = {
      maxAttempts: 3,
      backoffType: 'fixed',
      initialDelayMs: 1000,
      jitter: true,
    };

    for (let i = 0; i < 20; i++) {
      const delay = RetryCalculator.calculateDelay(policy, 1);
      // with jitter factor [0.75, 1.25], delay should be between 750 and 1250
      expect(delay).toBeGreaterThanOrEqual(750);
      expect(delay).toBeLessThanOrEqual(1250);
    }
  });
});
