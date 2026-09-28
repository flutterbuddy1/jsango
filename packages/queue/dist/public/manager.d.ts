import type { ILogger } from '@jsango/core';
import type { DispatchOptions, IQueueDriver, JobDefinition, WorkerOptions } from './types.js';
import { Queue } from './queue.js';
import { JobRegistry } from './registry.js';
import { Worker } from './worker.js';
import { type IFailedJobStore } from './failed-jobs.js';
export interface QueueConnectionConfig {
    readonly driver: string;
    readonly options?: Readonly<Record<string, unknown>> | undefined;
}
export interface QueueConfig {
    readonly default: string;
    readonly connections: Readonly<Record<string, QueueConnectionConfig>>;
    readonly workers?: {
        readonly concurrency?: number | undefined;
        readonly leaseTimeoutMs?: number | undefined;
        readonly pollingIntervalMs?: number | undefined;
    } | undefined;
}
export type QueueDriverFactory = (config: QueueConnectionConfig) => IQueueDriver;
export interface QueueManagerOptions {
    readonly logger?: ILogger | undefined;
    readonly registry?: JobRegistry | undefined;
    readonly failedJobStore?: IFailedJobStore | undefined;
}
/**
 * Production QueueManager orchestrating named queues, background workers,
 * driver factories, failed jobs, and application lifecycle shutdown.
 */
export declare class QueueManager {
    private readonly config;
    readonly logger: ILogger;
    readonly registry: JobRegistry;
    readonly failedJobStore: IFailedJobStore;
    private readonly driverFactories;
    private readonly driverInstances;
    private readonly queues;
    private readonly activeWorkers;
    private closed;
    constructor(config?: Partial<QueueConfig>, options?: QueueManagerOptions);
    registerDriver(name: string, factory: QueueDriverFactory | IQueueDriver): this;
    getDriver(connectionName?: string): IQueueDriver;
    /**
     * Retrieves or creates a named Queue handle.
     */
    queue(queueName?: string, connectionName?: string): Queue;
    /**
     * Convenience method: registers a job type definition into the manager's registry.
     */
    registerJob<Payload = unknown, Result = unknown>(definition: JobDefinition<Payload, Result>): this;
    /**
     * Convenience method: dispatches a job to the default queue.
     */
    dispatch<Payload = unknown>(type: string, payload: Payload, options?: DispatchOptions): Promise<string>;
    /**
     * Convenience method: delays a job on the default queue.
     */
    delay<Payload = unknown>(type: string, payload: Payload, delayMs: number, options?: DispatchOptions): Promise<string>;
    /**
     * Convenience method: schedules a job on the default queue.
     */
    schedule<Payload = unknown>(type: string, payload: Payload, at: Date | number, options?: DispatchOptions): Promise<string>;
    /**
     * Creates a Worker instance configured with the manager's driver and registry.
     */
    createWorker(options?: WorkerOptions): Worker;
    /**
     * Creates and immediately starts a Worker instance.
     */
    startWorker(options?: WorkerOptions): Worker;
    /**
     * Gracefully shuts down all active workers and closes all queue driver connections.
     */
    close(): Promise<void>;
    private assertNotClosed;
}
//# sourceMappingURL=manager.d.ts.map