export interface StampedeLockOptions {
    readonly timeoutMs?: number | undefined;
}
/**
 * In-flight single-flight coalescing mechanism to protect against cache stampedes
 * (dog-piling effect) within a process.
 */
export declare class StampedeLock {
    private readonly inFlight;
    private readonly defaultTimeoutMs;
    constructor(options?: StampedeLockOptions);
    /**
     * Executes a factory function or joins an already executing in-flight promise for the given key.
     */
    execute<T>(key: string, factory: () => Promise<T> | T, timeoutMs?: number): Promise<T>;
    /**
     * Returns true if there is an in-flight computation for the given key.
     */
    isInFlight(key: string): boolean;
    /**
     * Clears all in-flight locks.
     */
    clear(): void;
}
//# sourceMappingURL=stampede-lock.d.ts.map