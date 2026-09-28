import type { CacheOptions, CacheStats, ICacheDriver, ICacheStore } from './types.js';
/**
 * Logical cache namespace wrapper providing typed scoped cache operations.
 */
export declare class CacheNamespace implements ICacheStore {
    readonly namespaceName: string;
    private readonly store;
    constructor(namespaceName: string, store: ICacheStore);
    get name(): string;
    get driver(): ICacheDriver;
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
    namespace(prefix: string): ICacheStore;
    getStats(): CacheStats;
    resetStats(): void;
    close(): Promise<void>;
}
//# sourceMappingURL=namespace.d.ts.map