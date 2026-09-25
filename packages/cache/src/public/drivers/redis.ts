import type { CacheCapabilities, ICacheDriver } from '../types.js';
import { CacheConnectionError } from '../errors.js';

/**
 * Minimal structural interface for an external Redis client (e.g. ioredis, @redis/client).
 * Allows applications or infrastructure to provide their own Redis connection without
 * adding mandatory dependencies to @jsango/cache.
 */
export interface IRedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  incrby(key: string, amount: number): Promise<number>;
  decrby(key: string, amount: number): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  pttl(key: string): Promise<number>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  mset(entries: Record<string, string>): Promise<unknown>;
  flushdb(): Promise<unknown>;
  quit(): Promise<unknown>;
}

export interface RedisCacheDriverOptions {
  readonly client: IRedisClient;
}

/**
 * Redis Cache Driver Adapter implementing ICacheDriver over an injected IRedisClient.
 */
export class RedisCacheDriver implements ICacheDriver {
  public readonly name = 'redis';
  public readonly capabilities: CacheCapabilities = {
    supportsTtl: true,
    supportsIncrement: true,
    supportsMultiKey: true,
    supportsTags: false,
    maxKeyLength: 512,
  };

  private readonly client: IRedisClient;

  constructor(options: RedisCacheDriverOptions) {
    this.client = options.client;
  }

  public async get<T = unknown>(key: string): Promise<T | undefined> {
    try {
      const raw = await this.client.get(key);
      if (raw === null) {
        return undefined;
      }
      return raw as unknown as T;
    } catch (err) {
      throw new CacheConnectionError(
        `Redis GET failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    try {
      if (ttlMs !== undefined && ttlMs <= 0) {
        await this.client.del(key);
        return;
      }

      const strVal = typeof value === 'string' ? value : String(value);

      if (ttlMs !== undefined && ttlMs > 0) {
        await this.client.set(key, strVal, 'PX', ttlMs);
      } else {
        await this.client.set(key, strVal);
      }
    } catch (err) {
      throw new CacheConnectionError(
        `Redis SET failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async has(key: string): Promise<boolean> {
    try {
      const count = await this.client.exists(key);
      return count > 0;
    } catch (err) {
      throw new CacheConnectionError(
        `Redis EXISTS failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async delete(key: string): Promise<boolean> {
    try {
      const count = await this.client.del(key);
      return count > 0;
    } catch (err) {
      throw new CacheConnectionError(
        `Redis DEL failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async clear(): Promise<void> {
    try {
      await this.client.flushdb();
    } catch (err) {
      throw new CacheConnectionError(
        `Redis FLUSHDB failed: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async increment(key: string, amount = 1): Promise<number> {
    try {
      return await this.client.incrby(key, amount);
    } catch (err) {
      throw new CacheConnectionError(
        `Redis INCRBY failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async decrement(key: string, amount = 1): Promise<number> {
    try {
      return await this.client.decrby(key, amount);
    } catch (err) {
      throw new CacheConnectionError(
        `Redis DECRBY failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async expire(key: string, ttlMs: number): Promise<boolean> {
    try {
      if (ttlMs <= 0) {
        const deleted = await this.client.del(key);
        return deleted > 0;
      }
      const res = await this.client.pexpire(key, ttlMs);
      return res === 1;
    } catch (err) {
      throw new CacheConnectionError(
        `Redis PEXPIRE failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async ttl(key: string): Promise<number | undefined> {
    try {
      const pttl = await this.client.pttl(key);
      // Redis returns -2 if key does not exist, -1 if key exists without TTL
      if (pttl === -2) {
        return undefined;
      }
      if (pttl === -1) {
        return undefined;
      }
      return pttl;
    } catch (err) {
      throw new CacheConnectionError(
        `Redis PTTL failed for key "${key}": ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
    if (keys.length === 0) {
      return new Map<string, T>();
    }

    try {
      const values = await this.client.mget(...keys);
      const result = new Map<string, T>();
      for (let i = 0; i < keys.length; i++) {
        const val = values[i];
        if (val !== null && val !== undefined) {
          result.set(keys[i]!, val as unknown as T);
        }
      }
      return result;
    } catch (err) {
      throw new CacheConnectionError(
        `Redis MGET failed: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    ttlMs?: number
  ): Promise<void> {
    const map = entries instanceof Map ? entries : new Map(entries);
    if (map.size === 0) {
      return;
    }

    try {
      if (ttlMs !== undefined) {
        // Redis MSET does not accept TTL; set each key individually
        for (const [k, v] of map.entries()) {
          await this.set(k, v, ttlMs);
        }
        return;
      }

      const record: Record<string, string> = {};
      for (const [k, v] of map.entries()) {
        record[k] = typeof v === 'string' ? v : String(v);
      }
      await this.client.mset(record);
    } catch (err) {
      throw new CacheConnectionError(
        `Redis MSET failed: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async deleteMany(keys: readonly string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }
    try {
      return await this.client.del(...keys);
    } catch (err) {
      throw new CacheConnectionError(
        `Redis DEL failed: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  public async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // Ignore cleanup error on shutdown
    }
  }
}
