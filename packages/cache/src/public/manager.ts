import type {
  CacheFallbackMode,
  CacheOptions,
  CacheStats,
  ICacheDriver,
  ICacheStore,
} from './types.js';
import { CacheError } from './errors.js';
import { CacheStore } from './store.js';
import { MemoryCacheDriver } from './drivers/memory.js';
import { CacheKeyBuilder } from './key.js';
import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';

export interface CacheStoreConfig {
  readonly driver: string;
  readonly ttlMs?: number | undefined;
  readonly options?: Readonly<Record<string, unknown>> | undefined;
}

export interface CacheConfig {
  readonly default: string;
  readonly stores: Readonly<Record<string, CacheStoreConfig>>;
  readonly fallbackMode?: CacheFallbackMode | undefined;
  readonly prefix?: string | undefined;
  readonly application?: string | undefined;
  readonly environment?: string | undefined;
}

export type CacheDriverFactory = (config: CacheStoreConfig) => ICacheDriver;

export interface CacheManagerOptions {
  readonly logger?: ILogger | undefined;
}

/**
 * Production CacheManager orchestrating multiple named cache stores,
 * driver factories, fallback mechanisms, and lifecycle shutdown.
 */
export class CacheManager {
  private readonly config: CacheConfig;
  private readonly logger: ILogger;
  private readonly driverFactories = new Map<string, CacheDriverFactory>();
  private readonly stores = new Map<string, ICacheStore>();
  private memoryFallbackStore?: ICacheStore | undefined;
  private closed = false;

  constructor(config?: Partial<CacheConfig>, options: CacheManagerOptions = {}) {
    this.logger = options.logger ?? new NoopLogger();
    this.config = {
      default: config?.default ?? 'default',
      stores: config?.stores ?? {
        default: { driver: 'memory' },
      },
      fallbackMode: config?.fallbackMode ?? 'fail-fast',
      prefix: config?.prefix,
      application: config?.application,
      environment: config?.environment,
    };

    // Register built-in memory driver factory by default
    this.registerDriver('memory', (cfg) => {
      const maxEntries = cfg.options?.['maxEntries'] as number | undefined;
      return new MemoryCacheDriver({ maxEntries });
    });
  }

  public registerDriver(name: string, factory: CacheDriverFactory | ICacheDriver): this {
    const normalized = name.toLowerCase();
    if (typeof factory === 'function') {
      this.driverFactories.set(normalized, factory);
    } else {
      this.driverFactories.set(normalized, () => factory);
    }
    return this;
  }

  /**
   * Retrieves a configured cache store by name (or default).
   */
  public store(name?: string): ICacheStore {
    this.assertNotClosed();
    const storeName = name ?? this.config.default;

    const existing = this.stores.get(storeName);
    if (existing) {
      return existing;
    }

    const storeConfig = this.config.stores[storeName];
    if (!storeConfig) {
      throw new CacheError({
        code: 'ERR_CACHE_STORE_NOT_CONFIGURED',
        message: `Cache store "${storeName}" is not defined in cache configuration.`,
        metadata: { storeName },
        statusCode: 500,
      });
    }

    const driverFactory = this.driverFactories.get(storeConfig.driver.toLowerCase());
    if (!driverFactory) {
      throw new CacheError({
        code: 'ERR_CACHE_DRIVER_NOT_FOUND',
        message: `Cache driver "${storeConfig.driver}" for store "${storeName}" is not registered.`,
        metadata: { storeName, driver: storeConfig.driver },
        statusCode: 500,
      });
    }

    const driver = driverFactory(storeConfig);
    const keyBuilder = new CacheKeyBuilder({
      application: this.config.application,
      environment: this.config.environment,
      prefix: this.config.prefix,
      namespace: storeName === this.config.default ? undefined : storeName,
    });

    const store = new CacheStore({
      name: storeName,
      driver,
      keyBuilder,
      defaultTtlMs: storeConfig.ttlMs,
    });

    this.stores.set(storeName, store);
    return store;
  }

  // --- High-Level Convenience Delegation to Default Store ---

  public get<T = unknown>(key: string): Promise<T | undefined> {
    return this.executeWithFallback(async (s) => s.get<T>(key), undefined);
  }

  public set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void> {
    return this.executeWithFallback(async (s) => s.set<T>(key, value, options), undefined);
  }

  public has(key: string): Promise<boolean> {
    return this.executeWithFallback(async (s) => s.has(key), false);
  }

  public delete(key: string): Promise<boolean> {
    return this.executeWithFallback(async (s) => s.delete(key), false);
  }

  public clear(): Promise<void> {
    return this.executeWithFallback(async (s) => s.clear(), undefined);
  }

  public async remember<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    const primary = this.store();
    try {
      return await primary.remember<T>(key, factory, options);
    } catch (primaryErr) {
      const mode = this.config.fallbackMode ?? 'fail-fast';
      if (mode === 'fail-fast') {
        throw primaryErr;
      }

      this.logger.warn('Primary cache store failed; executing fallback policy', {
        mode,
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });

      if (mode === 'fallback-to-memory') {
        const fallback = this.getOrCreateMemoryFallback();
        return await fallback.remember<T>(key, factory, options);
      }

      // 'bypass' mode: execute factory directly without caching
      return await factory();
    }
  }

  public getOrSet<T>(
    key: string,
    factory: () => Promise<T> | T,
    options?: CacheOptions
  ): Promise<T> {
    return this.remember<T>(key, factory, options);
  }

  public increment(key: string, amount?: number): Promise<number> {
    return this.executeWithFallback(async (s) => s.increment(key, amount), 0);
  }

  public decrement(key: string, amount?: number): Promise<number> {
    return this.executeWithFallback(async (s) => s.decrement(key, amount), 0);
  }

  public expire(key: string, ttlMs: number): Promise<boolean> {
    return this.executeWithFallback(async (s) => s.expire(key, ttlMs), false);
  }

  public ttl(key: string): Promise<number | undefined> {
    return this.executeWithFallback(async (s) => s.ttl(key), undefined);
  }

  public namespace(prefix: string): ICacheStore {
    return this.store().namespace(prefix);
  }

  public getStats(): CacheStats {
    return this.store().getStats();
  }

  /**
   * Closes all initialized cache stores and their underlying drivers.
   */
  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;

    for (const store of this.stores.values()) {
      await store.close();
    }
    this.stores.clear();

    if (this.memoryFallbackStore) {
      await this.memoryFallbackStore.close();
      this.memoryFallbackStore = undefined;
    }
  }

  private async executeWithFallback<R>(
    operation: (store: ICacheStore) => Promise<R>,
    bypassFallbackValue: R
  ): Promise<R> {
    const primary = this.store();
    try {
      return await operation(primary);
    } catch (primaryErr) {
      const mode = this.config.fallbackMode ?? 'fail-fast';

      if (mode === 'fail-fast') {
        throw primaryErr;
      }

      this.logger.warn('Primary cache store failed; executing fallback policy', {
        mode,
        error: primaryErr instanceof Error ? primaryErr.message : String(primaryErr),
      });

      if (mode === 'fallback-to-memory') {
        const fallback = this.getOrCreateMemoryFallback();
        return await operation(fallback);
      }

      // 'bypass' mode: return bypass default
      return bypassFallbackValue;
    }
  }

  private getOrCreateMemoryFallback(): ICacheStore {
    if (!this.memoryFallbackStore) {
      this.memoryFallbackStore = new CacheStore({
        name: 'memory-fallback',
        driver: new MemoryCacheDriver({ maxEntries: 1000 }),
      });
    }
    return this.memoryFallbackStore;
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new CacheError({
        code: 'ERR_CACHE_MANAGER_CLOSED',
        message: 'CacheManager has already been closed.',
        statusCode: 500,
      });
    }
  }
}
