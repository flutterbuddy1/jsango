import { JobSerializationError } from './errors.js';
import { generateJobId } from './id.js';
import { DEFAULT_RETRY_POLICY } from './retry.js';
/**
 * Named Queue handle providing high-level typed job dispatching, scheduling, and inspection.
 */
export class Queue {
    name;
    driver;
    defaultMaxAttempts;
    defaultTimeoutMs;
    defaultRetryPolicy;
    constructor(options) {
        this.name = options.name;
        this.driver = options.driver;
        this.defaultMaxAttempts = options.defaultMaxAttempts ?? 3;
        this.defaultTimeoutMs = options.defaultTimeoutMs ?? 30_000;
        this.defaultRetryPolicy = {
            ...DEFAULT_RETRY_POLICY,
            ...(options.defaultRetryPolicy ?? {}),
        };
    }
    /**
     * Dispatches a job onto this queue for immediate execution.
     */
    async dispatch(type, payload, options = {}) {
        this.validatePayload(payload);
        const now = Date.now();
        let scheduledAt = now;
        if (options.delayMs !== undefined && options.delayMs > 0) {
            scheduledAt = now + options.delayMs;
        }
        else if (options.scheduleAt !== undefined) {
            scheduledAt =
                options.scheduleAt instanceof Date ? options.scheduleAt.getTime() : options.scheduleAt;
        }
        const priority = this.resolvePriority(options.priority);
        const retryPolicy = {
            ...this.defaultRetryPolicy,
            ...(options.retryPolicy ?? {}),
            maxAttempts: options.maxAttempts ?? this.defaultMaxAttempts,
        };
        const jobId = generateJobId();
        const job = {
            id: jobId,
            type,
            queue: this.name,
            payload,
            schemaVersion: options.schemaVersion ?? 1,
            status: scheduledAt > now ? 'scheduled' : 'pending',
            priority,
            attempt: 0,
            maxAttempts: options.maxAttempts ?? this.defaultMaxAttempts,
            timeoutMs: options.timeoutMs ?? this.defaultTimeoutMs,
            retryPolicy,
            createdAt: now,
            scheduledAt,
        };
        await this.driver.enqueue(job);
        return jobId;
    }
    /**
     * Dispatches a job delayed by the specified milliseconds.
     */
    async delay(type, payload, delayMs, options = {}) {
        return this.dispatch(type, payload, { ...options, delayMs });
    }
    /**
     * Schedules a job for future execution at a specific Date or timestamp.
     */
    async schedule(type, payload, scheduleAt, options = {}) {
        return this.dispatch(type, payload, { ...options, scheduleAt });
    }
    /**
     * Enqueues an already prepared Job model.
     */
    async enqueue(job) {
        this.validatePayload(job.payload);
        await this.driver.enqueue(job);
    }
    /**
     * Cancels a pending or scheduled job.
     */
    async cancel(jobId) {
        return this.driver.cancel(this.name, jobId);
    }
    /**
     * Retrieves a job by ID.
     */
    async getJob(jobId) {
        return this.driver.getJob(this.name, jobId);
    }
    /**
     * Clears all jobs in this queue.
     */
    async clear() {
        await this.driver.clear(this.name);
    }
    /**
     * Returns current pending and scheduled queue depth.
     */
    async depth() {
        return this.driver.getQueueDepth(this.name);
    }
    /**
     * Returns queue statistics.
     */
    async stats() {
        return this.driver.getStats(this.name);
    }
    resolvePriority(priority) {
        if (typeof priority === 'number') {
            return priority;
        }
        if (priority === 'high')
            return 10;
        if (priority === 'normal')
            return 5;
        if (priority === 'low')
            return 1;
        return 5;
    }
    validatePayload(payload) {
        if (payload === undefined) {
            throw new JobSerializationError('Job payload cannot be undefined.');
        }
        try {
            JSON.stringify(payload, (_key, val) => {
                if (typeof val === 'function') {
                    throw new Error('Closures and functions cannot be stored in job payloads.');
                }
                return val;
            });
        }
        catch (err) {
            if (err instanceof JobSerializationError) {
                throw err;
            }
            throw new JobSerializationError(`Job payload is not serializable: ${err instanceof Error ? err.message : String(err)}`, err);
        }
    }
}
//# sourceMappingURL=queue.js.map