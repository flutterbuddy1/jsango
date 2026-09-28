import type { IQueueDriver, Job, JobErrorMetadata, QueueCapabilities, QueueStats } from '../types.js';
/**
 * Deterministic In-Memory Queue Driver supporting priority ordering,
 * scheduled/delayed execution, and visibility leases.
 */
export declare class MemoryQueueDriver implements IQueueDriver {
    readonly name = "memory";
    readonly capabilities: QueueCapabilities;
    private readonly queues;
    enqueue<Payload = unknown>(job: Job<Payload>): Promise<void>;
    claim<Payload = unknown>(queueName: string, workerId: string, leaseTimeoutMs: number, count?: number): Promise<Job<Payload>[]>;
    acknowledge(queueName: string, jobId: string): Promise<boolean>;
    release(queueName: string, jobId: string, delayMs?: number, error?: JobErrorMetadata): Promise<boolean>;
    fail(queueName: string, jobId: string, error: JobErrorMetadata): Promise<boolean>;
    cancel(queueName: string, jobId: string): Promise<boolean>;
    getJob<Payload = unknown>(queueName: string, jobId: string): Promise<Job<Payload> | undefined>;
    clear(queueName: string): Promise<void>;
    getQueueDepth(queueName: string): Promise<number>;
    getStats(queueName: string): Promise<QueueStats>;
    close(): Promise<void>;
    private getOrCreateQueue;
}
//# sourceMappingURL=memory.d.ts.map