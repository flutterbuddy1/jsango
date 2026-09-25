export interface StampedeLockOptions {
  readonly timeoutMs?: number | undefined;
}

/**
 * In-flight single-flight coalescing mechanism to protect against cache stampedes
 * (dog-piling effect) within a process.
 */
export class StampedeLock {
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly defaultTimeoutMs: number;

  constructor(options: StampedeLockOptions = {}) {
    this.defaultTimeoutMs = options.timeoutMs ?? 30_000;
  }

  /**
   * Executes a factory function or joins an already executing in-flight promise for the given key.
   */
  public async execute<T>(
    key: string,
    factory: () => Promise<T> | T,
    timeoutMs?: number
  ): Promise<T> {
    const existing = this.inFlight.get(key) as Promise<T> | undefined;
    if (existing) {
      return existing;
    }

    const effectiveTimeout = timeoutMs ?? this.defaultTimeoutMs;

    const promise = (async () => {
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new Error(`Cache stampede lock timed out after ${effectiveTimeout}ms for key "${key}".`)
          );
        }, effectiveTimeout);
      });

      try {
        const resultPromise = Promise.resolve().then(() => factory());
        const result = await Promise.race([resultPromise, timeoutPromise]);
        return result;
      } finally {
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
  public isInFlight(key: string): boolean {
    return this.inFlight.has(key);
  }

  /**
   * Clears all in-flight locks.
   */
  public clear(): void {
    this.inFlight.clear();
  }
}
