/**
 * Lightweight, high-performance query client and cache for @jsango/admin-ui.
 * Provides caching, automatic stale-time handling, deduplication, retry, and invalidation.
 */
export class QueryClient {
    cache = new Map();
    inFlight = new Map();
    defaultStaleTimeMs;
    constructor(options = {}) {
        this.defaultStaleTimeMs = options.defaultStaleTimeMs ?? 10_000; // 10 seconds
    }
    serializeKey(key) {
        return JSON.stringify(key);
    }
    getQueryData(key) {
        const serialized = this.serializeKey(key);
        const entry = this.cache.get(serialized);
        if (!entry)
            return undefined;
        return entry.data;
    }
    setQueryData(key, data) {
        const serialized = this.serializeKey(key);
        this.cache.set(serialized, {
            data,
            timestamp: Date.now(),
        });
    }
    invalidateQueries(keyPrefix) {
        const prefixSerialized = JSON.stringify(keyPrefix);
        const prefixTrimmed = prefixSerialized.slice(0, -1); // remove trailing ']'
        for (const k of this.cache.keys()) {
            if (k.startsWith(prefixTrimmed)) {
                this.cache.delete(k);
            }
        }
    }
    clear() {
        this.cache.clear();
        this.inFlight.clear();
    }
    async fetchQuery(options) {
        const serialized = this.serializeKey(options.queryKey);
        const staleTime = options.staleTimeMs ?? this.defaultStaleTimeMs;
        const now = Date.now();
        const cached = this.cache.get(serialized);
        if (cached && now - cached.timestamp < staleTime) {
            return cached.data;
        }
        const running = this.inFlight.get(serialized);
        if (running) {
            return running;
        }
        const retries = options.retries ?? 1;
        const promise = (async () => {
            let lastError;
            for (let attempt = 0; attempt <= retries; attempt++) {
                try {
                    const result = await options.queryFn();
                    this.setQueryData(options.queryKey, result);
                    return result;
                }
                catch (err) {
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
    async mutate(options, variables) {
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
        }
        catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            if (options.onError) {
                await options.onError(error, variables);
            }
            throw error;
        }
    }
}
//# sourceMappingURL=query-client.js.map