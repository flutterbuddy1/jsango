import { describe, it, expect, beforeEach } from 'vitest';
import { CacheStore } from '../public/store.js';
import { MemoryCacheDriver } from '../public/drivers/memory.js';

describe('CacheStore', () => {
  let store: CacheStore;

  beforeEach(() => {
    const driver = new MemoryCacheDriver({ pruneIntervalMs: 0 });
    store = new CacheStore({ driver });
  });

  it('should get, set, and delete typed objects', async () => {
    interface Profile {
      id: string;
      email: string;
    }

    const profile: Profile = { id: 'p1', email: 'alice@example.com' };
    await store.set('profile:p1', profile);

    const retrieved = await store.get<Profile>('profile:p1');
    expect(retrieved).toEqual(profile);

    expect(await store.has('profile:p1')).toBe(true);
    await store.delete('profile:p1');
    expect(await store.has('profile:p1')).toBe(false);
  });

  it('should track stats accurately for hits, misses, sets, and deletes', async () => {
    await store.set('k1', 'val1');
    await store.get('k1'); // hit
    await store.get('missing'); // miss
    await store.delete('k1'); // delete

    const stats = store.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.sets).toBe(1);
    expect(stats.deletes).toBe(1);
  });

  it('should remember computed values via factory', async () => {
    let callCount = 0;
    const compute = async () => {
      callCount++;
      return { answer: 42 };
    };

    const res1 = await store.remember('computed', compute);
    expect(res1).toEqual({ answer: 42 });
    expect(callCount).toBe(1);

    // Second call should return cached value without executing factory
    const res2 = await store.remember('computed', compute);
    expect(res2).toEqual({ answer: 42 });
    expect(callCount).toBe(1);
  });

  it('should create scoped sub-namespaces', async () => {
    const userCache = store.namespace('users');
    await userCache.set('1', { name: 'Bob' });

    expect(await userCache.get('1')).toEqual({ name: 'Bob' });
    // Root store should have the prefixed key
    expect(await store.has('users:1')).toBe(true);
  });

  it('should support atomic increment and decrement', async () => {
    const c1 = await store.increment('visits');
    expect(c1).toBe(1);

    const c2 = await store.increment('visits', 10);
    expect(c2).toBe(11);

    const c3 = await store.decrement('visits', 4);
    expect(c3).toBe(7);
  });
});
