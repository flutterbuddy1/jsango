import type { CacheCapabilities, ICacheDriver } from '../types.js';
/**
 * Minimal structural interface for an external Redis client (e.g. ioredis, @redis/client).
 * Allows applications or infrastructure to provide their own Redis connection without
 * adding mandatory dependencies to @jsango/cache.
 */
export interface IRedisClient {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
    del(...keys: string[]): Promise<number>;
    exists(...keys: string[]): Promise<number>;
    incrby(key: string, amount: number): Promise<number>;
    decrby(key: string, amount: number): Promise<number>;
    pexpire(key: string, milliseconds: number): Promise<number>;
    pttl(key: string): Promise<number>;
    mget(...keys: string[]): Promise<(string | null)[]>;
    mset(entries: Record<string, string>): Promise<unknown>;
    flushdb(): Promise<unknown>;
    quit(): Promise<unknown>;
}
export interface RedisCacheDriverOptions {
    readonly client: IRedisClient;
}
/**
 * Redis Cache Driver Adapter implementing ICacheDriver over an injected IRedisClient.
 */
export declare class RedisCacheDriver implements ICacheDriver {
    readonly name = "redis";
    readonly capabilities: CacheCapabilities;
    private readonly client;
    constructor(options: RedisCacheDriverOptions);
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
    close(): Promise<void>;
}
//# sourceMappingURL=redis.d.ts.map