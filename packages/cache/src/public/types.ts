/**
 * Cache capabilities exposed explicitly by drivers.
 */
export interface CacheCapabilities {
  readonly supportsTtl: boolean;
  readonly supportsIncrement: boolean;
  readonly supportsMultiKey: boolean;
  readonly supportsTags: boolean;
  readonly maxKeyLength: number;
  readonly maxValueBytes?: number | undefined;
}

/**
 * Cache options passed to store set and remember operations.
 */
export interface CacheOptions {
  /**
   * Time-to-live in milliseconds. If <= 0, entry is immediately expired/invalidated.
   * If omitted or undefined, entry does not expire.
   */
  readonly ttlMs?: number | undefined;

  /**
   * Convenience alias: Time-to-live in seconds.
   * If both ttlMs and ttlSeconds are specified, ttlMs takes precedence.
   */
  readonly ttlSeconds?: number | undefined;

  /**
   * Cache tags (evaluated for future extension; see ADR-026).
   */
  readonly tags?: readonly string[] | undefined;
}

/**
 * Low-level stored cache entry format.
 */
export interface CacheEntry<T = unknown> {
  readonly key: string;
  readonly value: T;
  readonly expiresAt?: number | undefined;
  readonly createdAt: number;
}

/**
 * Lightweight statistics for cache health and future observability integration (Phase 14).
 */
export interface CacheStats {
  readonly hits: number;
  readonly misses: number;
  readonly sets: number;
  readonly deletes: number;
  readonly errors: number;
  readonly entryCount: number;
}

/**
 * Cache fallback behavior when a primary distributed store fails.
 */
export type CacheFallbackMode = 'fail-fast' | 'fallback-to-memory' | 'bypass';

/**
 * Raw driver contract implemented by all backend storage adapters.
 */
export interface ICacheDriver {
  readonly name: string;
  readonly capabilities: CacheCapabilities;

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
  setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    ttlMs?: number
  ): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<number>;

  close(): Promise<void>;
}

/**
 * High-level cache store interface exposed to application code.
 */
export interface ICacheStore {
  readonly name: string;
  readonly driver: ICacheDriver;

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
  setMany<T = unknown>(
    entries: ReadonlyMap<string, T> | readonly (readonly [string, T])[],
    options?: CacheOptions
  ): Promise<void>;
  deleteMany(keys: readonly string[]): Promise<number>;

  namespace(prefix: string): ICacheStore;
  getStats(): CacheStats;
  resetStats(): void;
  close(): Promise<void>;
}
