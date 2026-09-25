import type { CacheOptions, CacheStats, ICacheDriver, ICacheStore } from '../types.js';
import { MemoryCacheDriver } from '../drivers/memory.js';

export interface FakeRecordedCall {
  readonly method: string;
  readonly key: string;
  readonly args?: readonly unknown[] | undefined;
  readonly timestamp: number;
}

/**
 * Deterministic FakeCacheStore for unit and application testing with recorded spy calls.
 */
export class FakeCacheStore implements ICacheStore {
  public readonly name: string;
  public readonly driver: ICacheDriver;
  public readonly calls: FakeRecordedCall[] = [];

  private readonly storage = new Map<string, unknown>();
  private readonly expiries = new Map<string, number>();

  constructor(name = 'fake') {
    this.name = name;
    this.driver = new MemoryCacheDriver();
  }

  public async get<T = unknown>(key: string): Promise<T | undefined> {
    this.record('get', key);
    const expiry = this.expiries.get(key);
    if (expiry !== undefined && Date.now() >= expiry) {
      this.storage.delete(key);
      this.expiries.delete(key);
      return undefined;
    }
    return this.storage.get(key) as T | undefined;
  }

  public async set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void> {
    this.record('set', key, [value, options]);
    const ttlMs =
      options?.ttlMs ?? (options?.ttlSeconds !== undefined ? options.ttlSeconds * 1000 : undefined);
    if (ttlMs !== undefined && ttlMs <= 0) {
      this.storage.delete(key);
      this.expiries.delete(key);
      return;
    }

    this.storage.set(key, value);
    if (ttlMs !== undefined) {
      this.expiries.set(key, Date.now() + ttlMs);
    } else {
      this.expiries.delete(key);
    }
  }

  public async has(key: string): Promise<boolean> {
    this.record('has', key);
    const val = await this.get(key);
    return val !== undefined;
  }

  public async delete(key: string): Promise<boolean> {
    this.record('delete', key);
    const existed = this.storage.has(key);
    this.storage.delete(key);
    this.expiries.delete(key);
    return existed;
  }

  public async clear(): Promise<void> {
    this.record('clear', '*');
    this.storage.clear();
    this.expiries.clear();
  }

  public async remember<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    this.record('remember', key);
    const existing = await this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }
    const fresh = await factory();
    await this.set(key, fresh, options);
    return fresh;
  }

  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    return this.remember(key, factory, options);
  }

  public async increment(key: string, amount = 1): Promise<number> {
    this.record('increment', key, [amount]);
    const current = Number(this.storage.get(key) ?? 0);
    const updated = current + amount;
    this.storage.set(key, updated);
    return updated;
  }

  public async decrement(key: string, amount = 1): Promise<number> {
    return this.increment(key, -amount);
  }

  public async expire(key: string, ttlMs: number): Promise<boolean> {
    this.record('expire', key, [ttlMs]);
    if (!this.storage.has(key)) return false;
    if (ttlMs <= 0) {
      this.storage.delete(key);
      this.expiries.delete(key);
      return true;
    }
    this.expiries.set(key, Date.now() + ttlMs);
    return true;
  }

  public async ttl(key: string): Promise<number | undefined> {
    this.record('ttl', key);
    const exp = this.expiries.get(key);
    if (exp === undefined) return undefined;
    const remaining = exp - Date.now();
    return remaining > 0 ? remaining : undefined;
  }

  public async getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
    this.record('getMany', keys.join(','));
    const res = new Map<string, T>();
    for (const k of keys) {
      const v = await this.get<T>(k);
      if (v !== undefined) res.set(k, v);
    }
    return res;
  }

  public async setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    options?: CacheOptions
  ): Promise<void> {
    const iter = entries instanceof Map ? entries.entries() : entries;
    for (const [k, v] of iter) {
      await this.set(k, v, options);
    }
  }

  public async deleteMany(keys: readonly string[]): Promise<number> {
    let count = 0;
    for (const k of keys) {
      if (await this.delete(k)) count++;
    }
    return count;
  }

  public namespace(prefix: string): ICacheStore {
    return new FakeCacheStore(`${this.name}:${prefix}`);
  }

  public getStats(): CacheStats {
    return {
      hits: 0,
      misses: 0,
      sets: this.calls.filter((c) => c.method === 'set').length,
      deletes: this.calls.filter((c) => c.method === 'delete').length,
      errors: 0,
      entryCount: this.storage.size,
    };
  }

  public resetStats(): void {
    this.calls.length = 0;
  }

  public async close(): Promise<void> {
    this.storage.clear();
    this.expiries.clear();
  }

  private record(method: string, key: string, args?: readonly unknown[]): void {
    this.calls.push({
      method,
      key,
      args,
      timestamp: Date.now(),
    });
  }
}
