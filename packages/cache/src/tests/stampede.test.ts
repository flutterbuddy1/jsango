import { describe, it, expect } from 'vitest';
import { CacheStore } from '../public/store.js';
import { MemoryCacheDriver } from '../public/drivers/memory.js';

describe('Cache Stampede Protection', () => {
  it('should coalesce multiple concurrent calls to remember into a single factory execution', async () => {
    const driver = new MemoryCacheDriver({ pruneIntervalMs: 0 });
    const store = new CacheStore({ driver });

    let factoryExecutions = 0;
    const expensiveFactory = async () => {
      factoryExecutions++;
      // Simulate slow I/O
      await new Promise((r) => setTimeout(r, 40));
      return { result: 'expensive-data' };
    };

    // Fire 20 concurrent requests for the exact same uncached key
    const promises = Array.from({ length: 20 }, () =>
      store.remember('stampede-key', expensiveFactory)
    );

    const results = await Promise.all(promises);

    // All callers should have received the exact same data
    for (const res of results) {
      expect(res).toEqual({ result: 'expensive-data' });
    }

    // Factory must only have run ONCE!
    expect(factoryExecutions).toBe(1);
  });

  it('should release lock if factory throws an error so next request can retry', async () => {
    const driver = new MemoryCacheDriver({ pruneIntervalMs: 0 });
    const store = new CacheStore({ driver });

    let attempts = 0;
    const failingFactory = async () => {
      attempts++;
      if (attempts === 1) {
        throw new Error('Temporary backend failure');
      }
      return 'recovered-data';
    };

    // First attempt fails
    await expect(store.remember('flaky-key', failingFactory)).rejects.toThrow(
      'Temporary backend failure'
    );

    // Subsequent attempt should not be blocked or deadlocked
    const result = await store.remember('flaky-key', failingFactory);
    expect(result).toBe('recovered-data');
    expect(attempts).toBe(2);
  });
});
