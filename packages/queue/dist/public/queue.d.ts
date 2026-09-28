import type { DispatchOptions, IQueueDriver, Job, QueueStats, RetryPolicy } from './types.js';
export interface QueueOptions {
    readonly name: string;
    readonly driver: IQueueDriver;
    readonly defaultMaxAttempts?: number | undefined;
    readonly defaultTimeoutMs?: number | undefined;
    readonly defaultRetryPolicy?: Partial<RetryPolicy> | undefined;
}
/**
 * Named Queue handle providing high-level typed job dispatching, scheduling, and inspection.
 */
export declare class Queue {
    readonly name: string;
    readonly driver: IQueueDriver;
    private readonly defaultMaxAttempts;
    private readonly defaultTimeoutMs;
    private readonly defaultRetryPolicy;
    constructor(options: QueueOptions);
    /**
     * Dispatches a job onto this queue for immediate execution.
     */
    dispatch<Payload = unknown>(type: string, payload: Payload, options?: DispatchOptions): Promise<string>;
    /**
     * Dispatches a job delayed by the specified milliseconds.
     */
    delay<Payload = unknown>(type: string, payload: Payload, delayMs: number, options?: DispatchOptions): Promise<string>;
    /**
     * Schedules a job for future execution at a specific Date or timestamp.
     */
    schedule<Payload = unknown>(type: string, payload: Payload, scheduleAt: Date | number, options?: DispatchOptions): Promise<string>;
    /**
     * Enqueues an already prepared Job model.
     */
    enqueue<Payload = unknown>(job: Job<Payload>): Promise<void>;
    /**
     * Cancels a pending or scheduled job.
     */
    cancel(jobId: string): Promise<boolean>;
    /**
     * Retrieves a job by ID.
     */
    getJob<Payload = unknown>(jobId: string): Promise<Job<Payload> | undefined>;
    /**
     * Clears all jobs in this queue.
     */
    clear(): Promise<void>;
    /**
     * Returns current pending and scheduled queue depth.
     */
    depth(): Promise<number>;
    /**
     * Returns queue statistics.
     */
    stats(): Promise<QueueStats>;
    private resolvePriority;
    private validatePayload;
}
//# sourceMappingURL=queue.d.ts.map