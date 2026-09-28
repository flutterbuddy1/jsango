import type { CacheCapabilities, ICacheDriver } from '../types.js';
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
export declare class MemoryCacheDriver implements ICacheDriver {
    readonly name = "memory";
    readonly capabilities: CacheCapabilities;
    private readonly lru;
    private pruneTimer?;
    constructor(options?: MemoryCacheDriverOptions);
    get size(): number;
    get<T = unknown>(key: string): Promise<T | undefined>;
    set<T = unknown>(key: string, value: T, ttlMs?: number): Promise<void>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    clear(): Promise<void>;
    increment(key: string, amount?: number): Promise<number>;
    decrement(key: string, amount?: number): Promise<number>;
    expire(key: string, ttlMs: number): Promise<boolean>;
    ttl(key: string): Promise<number | undefined>;
    getMany<T = unknown>(keys: readonly string[]): Promise<ReadonlyMap<string, T>>;
    setMany<T = unknown>(entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[], ttlMs?: number): Promise<void>;
    deleteMany(keys: readonly string[]): Promise<number>;
    /**
     * Sweeps and evicts all expired keys in the cache.
     */
    pruneExpired(): number;
    close(): Promise<void>;
}
//# sourceMappingURL=memory.d.ts.map