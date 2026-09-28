import type { CacheOptions, CacheStats, ICacheDriver, ICacheStore } from '../types.js';
export interface FakeRecordedCall {
    readonly method: string;
    readonly key: string;
    readonly args?: readonly unknown[] | undefined;
    readonly timestamp: number;
}
/**
 * Deterministic FakeCacheStore for unit and application testing with recorded spy calls.
 */
export declare class FakeCacheStore implements ICacheStore {
    readonly name: string;
    readonly driver: ICacheDriver;
    readonly calls: FakeRecordedCall[];
    private readonly storage;
    private readonly expiries;
    constructor(name?: string);
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
    private record;
}
//# sourceMappingURL=fake.d.ts.map