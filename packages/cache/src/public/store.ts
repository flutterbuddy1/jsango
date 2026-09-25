import type {
  CacheCapabilities,
  CacheOptions,
  CacheStats,
  ICacheDriver,
  ICacheStore,
} from './types.js';
import { CacheKeyBuilder, type CacheKeyOptions } from './key.js';
import { type ICacheSerializer, SafeCacheSerializer } from './serializer.js';
import { StampedeLock } from '../internal/stampede-lock.js';

export interface CacheStoreOptions {
  readonly name?: string | undefined;
  readonly driver: ICacheDriver;
  readonly keyBuilder?: CacheKeyBuilder | undefined;
  readonly keyOptions?: CacheKeyOptions | undefined;
  readonly serializer?: ICacheSerializer | undefined;
  readonly defaultTtlMs?: number | undefined;
}

/**
 * Production CacheStore implementation.
 * Wraps an ICacheDriver with key building, safe serialization,
 * in-flight stampede defense, and lightweight stats.
 */
export class CacheStore implements ICacheStore {
  public readonly name: string;
  public readonly driver: ICacheDriver;
  public readonly keyBuilder: CacheKeyBuilder;
  public readonly serializer: ICacheSerializer;
  public readonly defaultTtlMs?: number | undefined;

  private readonly stampedeLock = new StampedeLock();
  private statsHits = 0;
  private statsMisses = 0;
  private statsSets = 0;
  private statsDeletes = 0;
  private statsErrors = 0;

  constructor(options: CacheStoreOptions) {
    this.name = options.name ?? options.driver.name;
    this.driver = options.driver;
    this.keyBuilder = options.keyBuilder ?? new CacheKeyBuilder(options.keyOptions);
    this.serializer = options.serializer ?? new SafeCacheSerializer();
    this.defaultTtlMs = options.defaultTtlMs;
  }

  public get capabilities(): CacheCapabilities {
    return this.driver.capabilities;
  }

  public async get<T = unknown>(key: string): Promise<T | undefined> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      const raw = await this.driver.get<string>(qualifiedKey);
      if (raw === undefined || raw === null) {
        this.statsMisses++;
        return undefined;
      }
      this.statsHits++;
      return this.serializer.deserialize<T>(raw);
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const qualifiedKey = this.keyBuilder.build(key);
    const ttlMs = this.resolveTtlMs(options);

    try {
      const serialized = this.serializer.serialize(value);
      await this.driver.set(qualifiedKey, serialized, ttlMs);
      this.statsSets++;
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async has(key: string): Promise<boolean> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      return await this.driver.has(qualifiedKey);
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async delete(key: string): Promise<boolean> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      const deleted = await this.driver.delete(qualifiedKey);
      if (deleted) {
        this.statsDeletes++;
      }
      return deleted;
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async clear(): Promise<void> {
    try {
      await this.driver.clear();
      this.stampedeLock.clear();
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async remember<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    const existing = await this.get<T>(key);
    if (existing !== undefined) {
      return existing;
    }

    const qualifiedKey = this.keyBuilder.build(key);

    return this.stampedeLock.execute<T>(qualifiedKey, async () => {
      // Re-check cache inside stampede lock in case another request already populated it
      const secondCheck = await this.get<T>(key);
      if (secondCheck !== undefined) {
        return secondCheck;
      }

      const freshValue = await factory();
      await this.set(key, freshValue, options);
      return freshValue;
    });
  }

  public async getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    return this.remember<T>(key, factory, options);
  }

  public async increment(key: string, amount = 1): Promise<number> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      return await this.driver.increment(qualifiedKey, amount);
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async decrement(key: string, amount = 1): Promise<number> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      return await this.driver.decrement(qualifiedKey, amount);
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async expire(key: string, ttlMs: number): Promise<boolean> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      return await this.driver.expire(qualifiedKey, ttlMs);
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async ttl(key: string): Promise<number | undefined> {
    const qualifiedKey = this.keyBuilder.build(key);
    try {
      return await this.driver.ttl(qualifiedKey);
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
    const resultMap = new Map<string, T>();
    if (keys.length === 0) {
      return resultMap;
    }

    const keyMap = new Map<string, string>(); // qualifiedKey -> originalKey
    const qualifiedKeys: string[] = [];

    for (const original of keys) {
      const qualified = this.keyBuilder.build(original);
      keyMap.set(qualified, original);
      qualifiedKeys.push(qualified);
    }

    try {
      const rawMap = await this.driver.getMany<string>(qualifiedKeys);
      for (const [qualified, raw] of rawMap.entries()) {
        const original = keyMap.get(qualified);
        if (original && raw !== undefined && raw !== null) {
          const deserialized = this.serializer.deserialize<T>(raw);
          resultMap.set(original, deserialized);
          this.statsHits++;
        }
      }

      this.statsMisses += keys.length - resultMap.size;
      return resultMap;
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    options?: CacheOptions
  ): Promise<void> {
    const entryIterable = entries instanceof Map ? entries.entries() : entries;
    const ttlMs = this.resolveTtlMs(options);

    const qualifiedEntries: [string, string][] = [];
    for (const [k, v] of entryIterable) {
      const qualified = this.keyBuilder.build(k);
      const serialized = this.serializer.serialize(v);
      qualifiedEntries.push([qualified, serialized]);
    }

    try {
      await this.driver.setMany(qualifiedEntries, ttlMs);
      this.statsSets += qualifiedEntries.length;
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  public async deleteMany(keys: readonly string[]): Promise<number> {
    if (keys.length === 0) {
      return 0;
    }

    const qualifiedKeys = keys.map((k) => this.keyBuilder.build(k));
    try {
      const count = await this.driver.deleteMany(qualifiedKeys);
      this.statsDeletes += count;
      return count;
    } catch (err) {
      this.statsErrors++;
      throw err;
    }
  }

  /**
   * Returns a new CacheStore scoped to a logical sub-namespace.
   */
  public namespace(prefix: string): ICacheStore {
    const subKeyBuilder = this.keyBuilder.withNamespace(prefix);
    return new CacheStore({
      name: `${this.name}:${prefix}`,
      driver: this.driver,
      keyBuilder: subKeyBuilder,
      serializer: this.serializer,
      defaultTtlMs: this.defaultTtlMs,
    });
  }

  public getStats(): CacheStats {
    let entryCount = 0;
    if ('size' in this.driver && typeof (this.driver as { size: number }).size === 'number') {
      entryCount = (this.driver as { size: number }).size;
    }

    return {
      hits: this.statsHits,
      misses: this.statsMisses,
      sets: this.statsSets,
      deletes: this.statsDeletes,
      errors: this.statsErrors,
      entryCount,
    };
  }

  public resetStats(): void {
    this.statsHits = 0;
    this.statsMisses = 0;
    this.statsSets = 0;
    this.statsDeletes = 0;
    this.statsErrors = 0;
  }

  public async close(): Promise<void> {
    this.stampedeLock.clear();
    await this.driver.close();
  }

  private resolveTtlMs(options?: CacheOptions): number | undefined {
    if (options?.ttlMs !== undefined) {
      return options.ttlMs;
    }
    if (options?.ttlSeconds !== undefined) {
      return options.ttlSeconds * 1000;
    }
    return this.defaultTtlMs;
  }
}
