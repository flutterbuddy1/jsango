import type { DatabaseManager } from '@jsango/database';
import type { IQueueDriver, Job, JobErrorMetadata, QueueCapabilities, QueueStats } from '../types.js';
export interface DatabaseQueueDriverOptions {
    readonly databaseManager: DatabaseManager;
    readonly tableName?: string | undefined;
    readonly connectionName?: string | undefined;
}
/**
 * Production Database Queue Driver leveraging @jsango/database
 * with safe SQL execution, leased claiming, and multi-worker safety.
 */
export declare class DatabaseQueueDriver implements IQueueDriver {
    readonly name = "database";
    readonly capabilities: QueueCapabilities;
    private readonly db;
    readonly tableName: string;
    private tableEnsured;
    constructor(options: DatabaseQueueDriverOptions);
    /**
     * Idempotently verifies or creates the jobs table.
     */
    ensureTable(): Promise<void>;
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
    private mapRowToJob;
}
//# sourceMappingURL=database.d.ts.map