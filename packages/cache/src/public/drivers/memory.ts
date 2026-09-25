import type { CacheCapabilities, ICacheDriver } from '../types.js';
import { LruCacheMap } from '../../internal/lru.js';

export interface MemoryCacheDriverOptions {
  readonly maxEntries?: number | undefined;
  /**
   * Optional periodic interval (in ms) to sweep expired keys.
   * Defaults to 60_000ms (1 minute). Set to 0 to disable background interval.
   */
  readonly pruneIntervalMs?: number | undefined;
}

/**
 * High-performance In-Memory Cache Driver with LRU eviction and deterministic TTL semantics.
 */
export class MemoryCacheDriver implements ICacheDriver {
  public readonly name = 'memory';
  public readonly capabilities: CacheCapabilities = {
    supportsTtl: true,
    supportsIncrement: true,
    supportsMultiKey: true,
    supportsTags: false,
    maxKeyLength: 1024,
  };

  private readonly lru: LruCacheMap<string, unknown>;
  private pruneTimer?: NodeJS.Timeout | undefined;

  constructor(options: MemoryCacheDriverOptions = {}) {
    this.lru = new LruCacheMap<string, unknown>({
      maxEntries: options.maxEntries,
    });

    const pruneInterval = options.pruneIntervalMs ?? 60_000;
    if (pruneInterval > 0) {
      this.pruneTimer = setInterval(() => {
        this.pruneExpired();
      }, pruneInterval);

      // Unref timer so it does not block node process exit
      if (typeof this.pruneTimer === 'object' && 'unref' in this.pruneTimer) {
        this.pruneTimer.unref();
      }
    }
  }

  public get size(): number {
    return this.lru.size;
  }

  public async get<T = unknown>(key: string): Promise<T | undefined> {
    const node = this.lru.get(key);
    if (!node) {
      return undefined;
    }

    const now = Date.now();
    if (node.expiresAt !== undefined && now >= node.expiresAt) {
      this.lru.delete(key);
      return undefined;
    }

    return node.value as T;
  }

  public async set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void> {
    const now = Date.now();

    // Zero or negative TTL means immediately expired -> delete if exists and do not store
    if (ttlMs !== undefined && ttlMs <= 0) {
      this.lru.delete(key);
      return;
    }

    const expiresAt = ttlMs !== undefined ? now + ttlMs : undefined;
    this.lru.set(key, value, expiresAt);
  }

  public async has(key: string): Promise<boolean> {
    const node = this.lru.peek(key);
    if (!node) {
      return false;
    }

    const now = Date.now();
    if (node.expiresAt !== undefined && now >= node.expiresAt) {
      this.lru.delete(key);
      return false;
    }

    return true;
  }

  public async delete(key: string): Promise<boolean> {
    return this.lru.delete(key);
  }

  public async clear(): Promise<void> {
    this.lru.clear();
  }

  public async increment(key: string, amount = 1): Promise<number> {
    const node = this.lru.get(key);
    const now = Date.now();

    if (node && node.expiresAt !== undefined && now >= node.expiresAt) {
      this.lru.delete(key);
    }

    const currentNode = this.lru.get(key);
    let currentVal = 0;
    let expiresAt: number | undefined;

    if (currentNode) {
      const num = Number(currentNode.value);
      currentVal = Number.isFinite(num) ? num : 0;
      expiresAt = currentNode.expiresAt;
    }

    const newVal = currentVal + amount;
    this.lru.set(key, newVal, expiresAt);
    return newVal;
  }

  public async decrement(key: string, amount = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  public async expire(key: string, ttlMs: number): Promise<boolean> {
    const node = this.lru.get(key);
    if (!node) {
      return false;
    }

    if (ttlMs <= 0) {
      this.lru.delete(key);
      return true;
    }

    node.expiresAt = Date.now() + ttlMs;
    return true;
  }

  public async ttl(key: string): Promise<number | undefined> {
    const node = this.lru.peek(key);
    if (!node) {
      return undefined;
    }

    if (node.expiresAt === undefined) {
      return undefined; // No expiration
    }

    const remaining = node.expiresAt - Date.now();
    if (remaining <= 0) {
      this.lru.delete(key);
      return undefined;
    }

    return remaining;
  }

  public async getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const val = await this.get<T>(key);
      if (val !== undefined) {
        result.set(key, val);
      }
    }
    return result;
  }

  public async setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    ttlMs?: number
  ): Promise<void> {
    const iterable = entries instanceof Map ? entries.entries() : entries;
    for (const [k, v] of iterable) {
      await this.set(k, v, ttlMs);
    }
  }

  public async deleteMany(keys: readonly string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (this.lru.delete(k)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Sweeps and evicts all expired keys in the cache.
   */
  public pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;

    for (const [key, node] of this.lru.entries()) {
      if (node.expiresAt !== undefined && now >= node.expiresAt) {
        this.lru.delete(key);
        pruned++;
      }
    }

    return pruned;
  }

  public async close(): Promise<void> {
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = undefined;
    }
    this.lru.clear();
  }
}
