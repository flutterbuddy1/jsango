import { describe, it, expect, vi } from 'vitest';
import { RedisCacheDriver, type IRedisClient } from '../public/drivers/redis.js';

describe('RedisCacheDriver Adapter', () => {
  it('should interact correctly with the injected IRedisClient', async () => {
    const memory = new Map<string, string>();
    const mockClient: IRedisClient = {
      get: vi.fn(async (key: string) => memory.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        memory.set(key, value);
        return 'OK';
      }),
      del: vi.fn(async (...keys: string[]) => {
        let count = 0;
        for (const k of keys) {
          if (memory.delete(k)) count++;
        }
        return count;
      }),
      exists: vi.fn(async (...keys: string[]) => {
        let c = 0;
        for (const k of keys) {
          if (memory.has(k)) c++;
        }
        return c;
      }),
      incrby: vi.fn(async (key: string, amt: number) => {
        const curr = Number(memory.get(key) ?? 0) + amt;
        memory.set(key, String(curr));
        return curr;
      }),
      decrby: vi.fn(async (key: string, amt: number) => {
        const curr = Number(memory.get(key) ?? 0) - amt;
        memory.set(key, String(curr));
        return curr;
      }),
      pexpire: vi.fn(async () => 1),
      pttl: vi.fn(async () => 5000),
      mget: vi.fn(async (...keys: string[]) => keys.map((k) => memory.get(k) ?? null)),
      mset: vi.fn(async (entries: Record<string, string>) => {
        for (const [k, v] of Object.entries(entries)) {
          memory.set(k, v);
        }
        return 'OK';
      }),
      flushdb: vi.fn(async () => {
        memory.clear();
        return 'OK';
      }),
      quit: vi.fn(async () => 'OK'),
    };

    const driver = new RedisCacheDriver({ client: mockClient });

    await driver.set('rkey', 'rval');
    expect(mockClient.set).toHaveBeenCalled();

    const val = await driver.get<string>('rkey');
    expect(val).toBe('rval');
    expect(mockClient.get).toHaveBeenCalledWith('rkey');

    expect(await driver.has('rkey')).toBe(true);

    const count = await driver.increment('counter', 5);
    expect(count).toBe(5);
    expect(mockClient.incrby).toHaveBeenCalledWith('counter', 5);

    await driver.delete('rkey');
    expect(mockClient.del).toHaveBeenCalledWith('rkey');

    await driver.clear();
    expect(mockClient.flushdb).toHaveBeenCalled();

    await driver.close();
    expect(mockClient.quit).toHaveBeenCalled();
  });
});
