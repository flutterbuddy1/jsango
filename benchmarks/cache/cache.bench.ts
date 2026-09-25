import { describe, bench, beforeAll } from 'vitest';
import {
  MemoryCacheDriver,
  CacheStore,
  CacheKeyBuilder,
  SafeCacheSerializer,
  CacheManager,
} from '../../packages/cache/src/index.js';

// Setup: shared driver and store instances
const driver = new MemoryCacheDriver({ maxEntries: 100_000, pruneIntervalMs: 0 });
const keyBuilder = new CacheKeyBuilder({ application: 'bench', environment: 'test' });
const serializer = new SafeCacheSerializer();
const store = new CacheStore({ name: 'bench', driver, keyBuilder, serializer });
const manager = new CacheManager({
  default: 'default',
  stores: { default: { driver: 'memory' } },
  application: 'bench',
  environment: 'test',
});

// Pre-populate cache for read benchmarks
beforeAll(async () => {
  for (let i = 0; i < 1000; i++) {
    await driver.set(`preloaded-key-${i}`, { id: i, name: `item-${i}`, active: true });
  }
  await store.set('bench-hit', { value: 42, label: 'cached-result' });
  await manager.set('manager-hit', { value: 99, label: 'managed-result' });
});

describe('Cache Benchmarks', () => {
  // --- Raw Driver Operations ---

  describe('MemoryCacheDriver', () => {
    let writeCounter = 0;

    bench('get (cache hit)', async () => {
      await driver.get(`preloaded-key-${writeCounter++ % 1000}`);
    });

    bench('get (cache miss)', async () => {
      await driver.get(`missing-key-${writeCounter++}`);
    });

    bench('set (no TTL)', async () => {
      await driver.set(`bench-set-${writeCounter++}`, { x: writeCounter });
    });

    bench('set (with TTL)', async () => {
      await driver.set(`bench-ttl-${writeCounter++}`, { x: writeCounter }, 60_000);
    });

    bench('has (existing key)', async () => {
      await driver.has(`preloaded-key-${writeCounter++ % 1000}`);
    });

    bench('delete', async () => {
      await driver.set(`bench-del-${writeCounter}`, 'deleteme');
      await driver.delete(`bench-del-${writeCounter++}`);
    });

    bench('increment', async () => {
      await driver.increment('bench-counter', 1);
    });
  });

  // --- Key Builder ---

  describe('CacheKeyBuilder', () => {
    bench('build key (simple)', () => {
      keyBuilder.build('user:profile:42');
    });

    bench('build key (namespaced)', () => {
      const nsBuilder = new CacheKeyBuilder({
        application: 'app',
        environment: 'prod',
        prefix: 'v2',
        namespace: 'sessions',
      });
      nsBuilder.build('abc123');
    });
  });

  // --- Serializer ---

  describe('SafeCacheSerializer', () => {
    const complexObj = {
      id: 12345,
      name: 'Test User',
      active: true,
      roles: ['admin', 'editor'],
      metadata: { lastLogin: new Date('2026-01-01'), score: BigInt(999) },
    };

    bench('serialize (complex object)', () => {
      serializer.serialize(complexObj);
    });

    bench('deserialize (complex object)', () => {
      const serialized = serializer.serialize(complexObj);
      serializer.deserialize(serialized);
    });

    bench('serialize (simple string)', () => {
      serializer.serialize('hello world');
    });
  });

  // --- CacheStore (layered) ---

  describe('CacheStore', () => {
    let storeCounter = 0;

    bench('get (hit, with key building + deserialization)', async () => {
      await store.get('bench-hit');
    });

    bench('set (with key building + serialization)', async () => {
      await store.set(`store-bench-${storeCounter++}`, { val: storeCounter });
    });

    bench('remember (hit, stampede path skipped)', async () => {
      await store.remember('bench-hit', async () => ({ value: 0, label: 'factory' }));
    });
  });

  // --- CacheManager (full stack) ---

  describe('CacheManager', () => {
    bench('get (delegated to default store)', async () => {
      await manager.get('manager-hit');
    });

    bench('set (delegated to default store)', async () => {
      await manager.set('manager-bench', { val: 42 });
    });

    bench('store() resolution (cached)', () => {
      manager.store('default');
    });
  });

  // --- Batch Operations ---

  describe('Batch Operations', () => {
    bench('getMany (10 keys)', async () => {
      const keys = Array.from({ length: 10 }, (_, i) => `preloaded-key-${i}`);
      await driver.getMany(keys);
    });

    bench('setMany (10 entries)', async () => {
      const entries: [string, unknown][] = Array.from({ length: 10 }, (_, i) => [
        `batch-set-${i}`,
        { id: i },
      ]);
      await driver.setMany(entries);
    });

    bench('deleteMany (10 keys)', async () => {
      const keys = Array.from({ length: 10 }, (_, i) => `batch-set-${i}`);
      await driver.deleteMany(keys);
    });
  });
});
