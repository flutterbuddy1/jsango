import type { RetryPolicy } from './types.js';
export declare const DEFAULT_RETRY_POLICY: RetryPolicy;
/**
 * Calculates backoff delay for retrying failed jobs.
 */
export declare class RetryCalculator {
    /**
     * Determines if a job should be retried based on attempt count.
     */
    static shouldRetry(attempt: number, maxAttempts: number): boolean;
    /**
     * Calculates the delay in milliseconds for the next retry attempt.
     */
    static calculateDelay(policy: RetryPolicy, attempt: number): number;
}
//# sourceMappingURL=retry.d.ts.map