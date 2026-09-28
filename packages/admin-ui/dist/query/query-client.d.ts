/**
 * Lightweight, high-performance query client and cache for @jsango/admin-ui.
 * Provides caching, automatic stale-time handling, deduplication, retry, and invalidation.
 */
export interface QueryOptions<T> {
    readonly queryKey: readonly unknown[];
    readonly queryFn: () => Promise<T>;
    readonly staleTimeMs?: number | undefined;
    readonly retries?: number | undefined;
}
export interface MutationOptions<TData, TVariables> {
    readonly mutationFn: (variables: TVariables) => Promise<TData>;
    readonly onSuccess?: ((data: TData, variables: TVariables) => void | Promise<void>) | undefined;
    readonly onError?: ((error: Error, variables: TVariables) => void | Promise<void>) | undefined;
    readonly invalidateKeys?: readonly (readonly unknown[])[] | undefined;
}
export interface CacheEntry<T = unknown> {
    readonly data: T;
    readonly timestamp: number;
}
export declare class QueryClient {
    private readonly cache;
    private readonly inFlight;
    private readonly defaultStaleTimeMs;
    constructor(options?: {
        readonly defaultStaleTimeMs?: number | undefined;
    });
    serializeKey(key: readonly unknown[]): string;
    getQueryData<T>(key: readonly unknown[]): T | undefined;
    setQueryData<T>(key: readonly unknown[], data: T): void;
    invalidateQueries(keyPrefix: readonly unknown[]): void;
    clear(): void;
    fetchQuery<T>(options: QueryOptions<T>): Promise<T>;
    mutate<TData, TVariables>(options: MutationOptions<TData, TVariables>, variables: TVariables): Promise<TData>;
}
//# sourceMappingURL=query-client.d.ts.map