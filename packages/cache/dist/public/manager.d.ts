import type { CacheFallbackMode, CacheOptions, CacheStats, ICacheDriver, ICacheStore } from './types.js';
import type { ILogger } from '@jsango/core';
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
export declare class CacheManager {
    private readonly config;
    private readonly logger;
    private readonly driverFactories;
    private readonly stores;
    private memoryFallbackStore?;
    private closed;
    constructor(config?: Partial<CacheConfig>, options?: CacheManagerOptions);
    registerDriver(name: string, factory: CacheDriverFactory | ICacheDriver): this;
    /**
     * Retrieves a configured cache store by name (or default).
     */
    store(name?: string): ICacheStore;
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T = unknown>(key: string, value: T, options?: CacheOptions): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    remember<T>(key: string, factory: () => Promise<T> | T, options?: CacheOptions): Promise<T>;
    getOrSet<T>(key: string, factory: () => Promise<T> | T, options?: CacheOptions): Promise<T>;
    increment(key: string, amount?: number): Promise<number>;
    decrement(key: string, amount?: number): Promise<number>;
    expire(key: string, ttlMs: number): Promise<boolean>;
    ttl(key: string): Promise<number | undefined>;
    namespace(prefix: string): ICacheStore;
    getStats(): CacheStats;
    /**
     * Closes all initialized cache stores and their underlying drivers.
     */
    close(): Promise<void>;
    private executeWithFallback;
    private getOrCreateMemoryFallback;
    private assertNotClosed;
}
//# sourceMappingURL=manager.d.ts.map