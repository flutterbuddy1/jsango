import type { CacheCapabilities, CacheOptions, CacheStats, ICacheDriver, ICacheStore } from './types.js';
import { CacheKeyBuilder, type CacheKeyOptions } from './key.js';
import { type ICacheSerializer } from './serializer.js';
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
export declare class CacheStore implements ICacheStore {
    readonly name: string;
    readonly driver: ICacheDriver;
    readonly keyBuilder: CacheKeyBuilder;
    readonly serializer: ICacheSerializer;
    readonly defaultTtlMs?: number | undefined;
    private readonly stampedeLock;
    private statsHits;
    private statsMisses;
    private statsSets;
    private statsDeletes;
    private statsErrors;
    constructor(options: CacheStoreOptions);
    get capabilities(): CacheCapabilities;
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
    getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>>;
    setMany<T = unknown>(entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[], options?: CacheOptions): Promise<void>;
    deleteMany(keys: readonly string[]): Promise<number>;
    /**
     * Returns a new CacheStore scoped to a logical sub-namespace.
     */
    namespace(prefix: string): ICacheStore;
    getStats(): CacheStats;
    resetStats(): void;
    close(): Promise<void>;
    private resolveTtlMs;
}
//# sourceMappingURL=store.d.ts.map