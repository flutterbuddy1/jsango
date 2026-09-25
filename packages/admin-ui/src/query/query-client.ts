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

export class QueryClient {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly defaultStaleTimeMs: number;

  constructor(options: { readonly defaultStaleTimeMs?: number | undefined } = {}) {
    this.defaultStaleTimeMs = options.defaultStaleTimeMs ?? 10_000; // 10 seconds
  }

  public serializeKey(key: readonly unknown[]): string {
    return JSON.stringify(key);
  }

  public getQueryData<T>(key: readonly unknown[]): T | undefined {
    const serialized = this.serializeKey(key);
    const entry = this.cache.get(serialized);
    if (!entry) return undefined;
    return entry.data as T;
  }

  public setQueryData<T>(key: readonly unknown[], data: T): void {
    const serialized = this.serializeKey(key);
    this.cache.set(serialized, {
      data,
      timestamp: Date.now(),
    });
  }

  public invalidateQueries(keyPrefix: readonly unknown[]): void {
    const prefixSerialized = JSON.stringify(keyPrefix);
    const prefixTrimmed = prefixSerialized.slice(0, -1); // remove trailing ']'

    for (const k of this.cache.keys()) {
      if (k.startsWith(prefixTrimmed)) {
        this.cache.delete(k);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
    this.inFlight.clear();
  }

  public async fetchQuery<T>(options: QueryOptions<T>): Promise<T> {
    const serialized = this.serializeKey(options.queryKey);
    const staleTime = options.staleTimeMs ?? this.defaultStaleTimeMs;
    const now = Date.now();

    const cached = this.cache.get(serialized);
    if (cached && now - cached.timestamp < staleTime) {
      return cached.data as T;
    }

    const running = this.inFlight.get(serialized);
    if (running) {
      return running as Promise<T>;
    }

    const retries = options.retries ?? 1;
    const promise = (async () => {
      let lastError: unknown;
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const result = await options.queryFn();
          this.setQueryData(options.queryKey, result);
          return result;
        } catch (err: unknown) {
          lastError = err;
          if (attempt < retries) {
            await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
          }
        }
      }
      throw lastError instanceof Error ? lastError : new Error(String(lastError));
    })().finally(() => {
      this.inFlight.delete(serialized);
    });

    this.inFlight.set(serialized, promise);
    return promise;
  }

  public async mutate<TData, TVariables>(
    options: MutationOptions<TData, TVariables>,
    variables: TVariables
  ): Promise<TData> {
    try {
      const data = await options.mutationFn(variables);
      if (options.invalidateKeys) {
        for (const key of options.invalidateKeys) {
          this.invalidateQueries(key);
        }
      }
      if (options.onSuccess) {
        await options.onSuccess(data, variables);
      }
      return data;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      if (options.onError) {
        await options.onError(error, variables);
      }
      throw error;
    }
  }
}
