export interface LruNode<K, V> {
    key: K;
    value: V;
    expiresAt?: number | undefined;
    createdAt: number;
    prev: LruNode<K, V> | null;
    next: LruNode<K, V> | null;
}
export interface LruOptions {
    readonly maxEntries?: number | undefined;
}
/**
 * High-performance, zero-dependency Doubly-Linked LRU Cache Map.
 * Provides guaranteed O(1) reads, updates, and evictions.
 */
export declare class LruCacheMap<K, V> {
    readonly maxEntries: number;
    private readonly map;
    private readonly head;
    private readonly tail;
    constructor(options?: LruOptions);
    get size(): number;
    get(key: K): LruNode<K, V> | undefined;
    peek(key: K): LruNode<K, V> | undefined;
    set(key: K, value: V, expiresAt?: number): LruNode<K, V>;
    delete(key: K): boolean;
    has(key: K): boolean;
    clear(): void;
    keys(): IterableIterator<K>;
    entries(): IterableIterator<[K, LruNode<K, V>]>;
    private evictOldest;
    private detach;
    private attachHead;
}
//# sourceMappingURL=lru.d.ts.map