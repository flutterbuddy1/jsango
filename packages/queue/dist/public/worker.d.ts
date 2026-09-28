import type { ILogger } from '@jsango/core';
import type { IQueueDriver, Job, WorkerOptions } from './types.js';
import type { JobRegistry } from './registry.js';
import type { IFailedJobStore } from './failed-jobs.js';
import { QueueMiddlewarePipeline, type QueueMiddlewareHandler } from './middleware.js';
export type JobLifecycleHook = (job: Readonly<Job<unknown>>, metadata?: Record<string, unknown>) => Promise<void> | void;
export interface WorkerHooks {
    onJobStarted?: JobLifecycleHook | undefined;
    onJobCompleted?: JobLifecycleHook | undefined;
    onJobFailed?: JobLifecycleHook | undefined;
    onJobRetried?: JobLifecycleHook | undefined;
}
/**
 * Production Queue Worker with bounded concurrency, controlled polling,
 * AbortSignal timeouts, exponential backoff retries, and graceful shutdown.
 */
export declare class Worker {
    readonly id: string;
    readonly driver: IQueueDriver;
    readonly registry: JobRegistry;
    readonly queues: readonly string[];
    readonly concurrency: number;
    readonly leaseTimeoutMs: number;
    readonly pollingIntervalMs: number;
    readonly idleBackoffMs: number;
    readonly maxIdleBackoffMs: number;
    readonly shutdownTimeoutMs: number;
    readonly logger: ILogger;
    readonly failedJobStore?: IFailedJobStore | undefined;
    readonly middlewarePipeline: QueueMiddlewarePipeline;
    private isRunning;
    private isStopping;
    private currentIdleDelay;
    private readonly activeJobs;
    private loopPromise?;
    private stopResolve?;
    private hooks;
    constructor(driver: IQueueDriver, registry: JobRegistry, options?: WorkerOptions, failedJobStore?: IFailedJobStore);
    get running(): boolean;
    get activeCount(): number;
    setHooks(hooks: WorkerHooks): this;
    use(handler: QueueMiddlewareHandler): this;
    /**
     * Starts the background worker processing loop.
     */
    start(): this;
    /**
     * Executes a single processing pass across all configured queues (useful for CLI and testing).
     */
    runOnce(): Promise<number>;
    /**
     * Initiates graceful shutdown: stops polling, allows in-flight jobs to complete,
     * and exits within shutdownTimeoutMs.
     */
    stop(): Promise<void>;
    private runLoop;
    private processJob;
    private handlePermanentFailure;
    private delay;
}
//# sourceMappingURL=worker.d.ts.map