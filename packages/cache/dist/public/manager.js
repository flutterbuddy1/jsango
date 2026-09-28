import { CacheError } from './errors.js';
import { CacheStore } from './store.js';
import { MemoryCacheDriver } from './drivers/memory.js';
import { CacheKeyBuilder } from './key.js';
import { NoopLogger } from '@jsango/core';
/**
 * Production CacheManager orchestrating multiple named cache stores,
 * driver factories, fallback mechanisms, and lifecycle shutdown.
 */
export class CacheManager {
    config;
    logger;
    driverFactories = new Map();
    stores = new Map();
    memoryFallbackStore;
    closed = false;
    constructor(config, options = {}) {
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
            const maxEntries = cfg.options?.['maxEntries'];
            return new MemoryCacheDriver({ maxEntries });
        });
    }
    registerDriver(name, factory) {
        const normalized = name.toLowerCase();
        if (typeof factory === 'function') {
            this.driverFactories.set(normalized, factory);
        }
        else {
            this.driverFactories.set(normalized, () => factory);
        }
        return this;
    }
    /**
     * Retrieves a configured cache store by name (or default).
     */
    store(name) {
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
    get(key) {
        return this.executeWithFallback(async (s) => s.get(key), undefined);
    }
    set(key, value, options) {
        return this.executeWithFallback(async (s) => s.set(key, value, options), undefined);
    }
    has(key) {
        return this.executeWithFallback(async (s) => s.has(key), false);
    }
    delete(key) {
        return this.executeWithFallback(async (s) => s.delete(key), false);
    }
    clear() {
        return this.executeWithFallback(async (s) => s.clear(), undefined);
    }
    async remember(key, factory, options) {
        const primary = this.store();
        try {
            return await primary.remember(key, factory, options);
        }
        catch (primaryErr) {
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
                return await fallback.remember(key, factory, options);
            }
            // 'bypass' mode: execute factory directly without caching
            return await factory();
        }
    }
    getOrSet(key, factory, options) {
        return this.remember(key, factory, options);
    }
    increment(key, amount) {
        return this.executeWithFallback(async (s) => s.increment(key, amount), 0);
    }
    decrement(key, amount) {
        return this.executeWithFallback(async (s) => s.decrement(key, amount), 0);
    }
    expire(key, ttlMs) {
        return this.executeWithFallback(async (s) => s.expire(key, ttlMs), false);
    }
    ttl(key) {
        return this.executeWithFallback(async (s) => s.ttl(key), undefined);
    }
    namespace(prefix) {
        return this.store().namespace(prefix);
    }
    getStats() {
        return this.store().getStats();
    }
    /**
     * Closes all initialized cache stores and their underlying drivers.
     */
    async close() {
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
    async executeWithFallback(operation, bypassFallbackValue) {
        const primary = this.store();
        try {
            return await operation(primary);
        }
        catch (primaryErr) {
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
    getOrCreateMemoryFallback() {
        if (!this.memoryFallbackStore) {
            this.memoryFallbackStore = new CacheStore({
                name: 'memory-fallback',
                driver: new MemoryCacheDriver({ maxEntries: 1000 }),
            });
        }
        return this.memoryFallbackStore;
    }
    assertNotClosed() {
        if (this.closed) {
            throw new CacheError({
                code: 'ERR_CACHE_MANAGER_CLOSED',
                message: 'CacheManager has already been closed.',
                statusCode: 500,
            });
        }
    }
}
//# sourceMappingURL=manager.js.map