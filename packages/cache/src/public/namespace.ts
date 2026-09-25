import type { CacheOptions, CacheStats, ICacheDriver, ICacheStore } from './types.js';

/**
 * Logical cache namespace wrapper providing typed scoped cache operations.
 */
export class CacheNamespace implements ICacheStore {
  public readonly namespaceName: string;
  private readonly store: ICacheStore;

  constructor(namespaceName: string, store: ICacheStore) {
    this.namespaceName = namespaceName;
    this.store = store.namespace(namespaceName);
  }

  public get name(): string {
    return this.store.name;
  }

  public get driver(): ICacheDriver {
    return this.store.driver;
  }

  public get<T = unknown>(key: string): Promise<T | undefined> {
    return this.store.get<T>(key);
  }

  public set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void> {
    return this.store.set<T>(key, value, options);
  }

  public has(key: string): Promise<boolean> {
    return this.store.has(key);
  }

  public delete(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  public clear(): Promise<void> {
    return this.store.clear();
  }

  public remember<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    return this.store.remember<T>(key, factory, options);
  }

  public getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    return this.store.getOrSet<T>(key, factory, options);
  }

  public increment(key: string, amount?: number): Promise<number> {
    return this.store.increment(key, amount);
  }

  public decrement(key: string, amount?: number): Promise<number> {
    return this.store.decrement(key, amount);
  }

  public expire(key: string, ttlMs: number): Promise<boolean> {
    return this.store.expire(key, ttlMs);
  }

  public ttl(key: string): Promise<number | undefined> {
    return this.store.ttl(key);
  }

  public getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>> {
    return this.store.getMany<T>(keys);
  }

  public setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    options?: CacheOptions
  ): Promise<void> {
    return this.store.setMany<T>(entries, options);
  }

  public deleteMany(keys: readonly string[]): Promise<number> {
    return this.store.deleteMany(keys);
  }

  public namespace(prefix: string): ICacheStore {
    return this.store.namespace(prefix);
  }

  public getStats(): CacheStats {
    return this.store.getStats();
  }

  public resetStats(): void {
    this.store.resetStats();
  }

  public close(): Promise<void> {
    return this.store.close();
  }
}
