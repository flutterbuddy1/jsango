import { describe, it, expect } from 'vitest';
import { CacheManager } from '../public/manager.js';
import { CacheError } from '../public/errors.js';

describe('CacheManager', () => {
  it('should initialize default store and delegate high-level calls', async () => {
    const manager = new CacheManager({
      default: 'default',
      stores: {
        default: { driver: 'memory' },
      },
    });

    await manager.set('test-key', 'val');
    expect(await manager.get('test-key')).toBe('val');
    expect(await manager.has('test-key')).toBe(true);

    await manager.close();
  });

  it('should resolve multiple named stores independently', async () => {
    const manager = new CacheManager({
      default: 'fast',
      stores: {
        fast: { driver: 'memory' },
        sessions: { driver: 'memory' },
      },
    });

    const fastStore = manager.store('fast');
    const sessionStore = manager.store('sessions');

    await fastStore.set('k', 'fast-val');
    await sessionStore.set('k', 'session-val');

    expect(await fastStore.get('k')).toBe('fast-val');
    expect(await sessionStore.get('k')).toBe('session-val');

    await manager.close();
  });

  it('should fail-fast when a faulty driver is configured with fail-fast mode', async () => {
    const faultyDriver: any = {
      name: 'faulty',
      capabilities: { supportsTtl: true },
      get: async () => {
        throw new Error('Database connection refused');
      },
      close: async () => {},
    };

    const manager = new CacheManager({
      default: 'broken',
      fallbackMode: 'fail-fast',
      stores: {
        broken: { driver: 'faulty' },
      },
    });
    manager.registerDriver('faulty', faultyDriver);

    await expect(manager.get('some-key')).rejects.toThrow('Database connection refused');
    await manager.close();
  });

  it('should fallback to memory when configured with fallback-to-memory mode', async () => {
    const faultyDriver: any = {
      name: 'faulty',
      capabilities: { supportsTtl: true },
      get: async () => {
        throw new Error('Downstream network down');
      },
      set: async () => {
        throw new Error('Downstream network down');
      },
      close: async () => {},
    };

    const manager = new CacheManager({
      default: 'broken',
      fallbackMode: 'fallback-to-memory',
      stores: {
        broken: { driver: 'faulty' },
      },
    });
    manager.registerDriver('faulty', faultyDriver);

    // Set succeeds on memory fallback instead of throwing
    await manager.set('fallback-key', 'survived');
    expect(await manager.get('fallback-key')).toBe('survived');

    await manager.close();
  });

  it('should throw CacheError when accessing closed manager', async () => {
    const manager = new CacheManager();
    await manager.close();

    expect(() => manager.store()).toThrow(CacheError);
  });
});
