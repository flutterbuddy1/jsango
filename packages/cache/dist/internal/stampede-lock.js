/**
 * In-flight single-flight coalescing mechanism to protect against cache stampedes
 * (dog-piling effect) within a process.
 */
export class StampedeLock {
    inFlight = new Map();
    defaultTimeoutMs;
    constructor(options = {}) {
        this.defaultTimeoutMs = options.timeoutMs ?? 30_000;
    }
    /**
     * Executes a factory function or joins an already executing in-flight promise for the given key.
     */
    async execute(key, factory, timeoutMs) {
        const existing = this.inFlight.get(key);
        if (existing) {
            return existing;
        }
        const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;
        const promise = (async () => {
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error(`Cache stampede lock timed out after ${effectiveTimeout}ms for key "${key}".`));
                }, effectiveTimeout);
            });
            try {
                const resultPromise = Promise.resolve().then(() => factory());
                const result = await Promise.race([resultPromise, timeoutPromise]);
                return result;
            }
            finally {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
                this.inFlight.delete(key);
            }
        })();
        this.inFlight.set(key, promise);
        return promise;
    }
    /**
     * Returns true if there is an in-flight computation for the given key.
     */
    isInFlight(key) {
        return this.inFlight.has(key);
    }
    /**
     * Clears all in-flight locks.
     */
    clear() {
        this.inFlight.clear();
    }
}
//# sourceMappingURL=stampede-lock.js.map