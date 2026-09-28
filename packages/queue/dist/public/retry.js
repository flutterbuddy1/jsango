export const DEFAULT_RETRY_POLICY = {
    maxAttempts: 3,
    backoffType: 'exponential',
    initialDelayMs: 1000,
    maxDelayMs: 60_000,
    jitter: true,
};
/**
 * Calculates backoff delay for retrying failed jobs.
 */
export class RetryCalculator {
    /**
     * Determines if a job should be retried based on attempt count.
     */
    static shouldRetry(attempt, maxAttempts) {
        return attempt < maxAttempts;
    }
    /**
     * Calculates the delay in milliseconds for the next retry attempt.
     */
    static calculateDelay(policy, attempt) {
        let delayMs;
        if (policy.backoffType === 'fixed') {
            delayMs = policy.initialDelayMs;
        }
        else {
            // Exponential: initialDelayMs * 2^(attempt - 1)
            const exponent = Math.max(0, attempt - 1);
            delayMs = policy.initialDelayMs * Math.pow(2, exponent);
        }
        if (policy.maxDelayMs !== undefined && policy.maxDelayMs > 0) {
            delayMs = Math.min(delayMs, policy.maxDelayMs);
        }
        if (policy.jitter) {
            // Full jitter: uniformly random between 0.75 * delay and 1.25 * delay
            const jitterFactor = 0.75 + Math.random() * 0.5;
            delayMs = Math.floor(delayMs * jitterFactor);
        }
        return Math.max(0, delayMs);
    }
}
//# sourceMappingURL=retry.js.map