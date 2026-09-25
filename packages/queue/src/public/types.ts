import type { ILogger } from '@jsango/core';

export type JobStatus =
  'pending' | 'scheduled' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type JobPriority = 'low' | 'normal' | 'high' | number;

export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly backoffType: 'fixed' | 'exponential';
  readonly initialDelayMs: number;
  readonly maxDelayMs?: number | undefined;
  readonly jitter?: boolean | undefined;
}

export interface JobErrorMetadata {
  readonly [key: string]: unknown;
  readonly errorType: string;
  readonly message: string;
  readonly stack?: string | undefined;
  readonly failedAt: number;
  readonly attempt: number;
}

/**
 * Versionable, immutable Job model.
 * Carries serializable state across process boundaries.
 */
export interface Job<Payload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly queue: string;
  readonly payload: Payload;
  readonly schemaVersion: number;
  readonly status: JobStatus;
  readonly priority: number;
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;
  readonly createdAt: number;
  readonly scheduledAt: number;
  readonly lockedAt?: number | undefined;
  readonly lockedUntil?: number | undefined;
  readonly lockedBy?: string | undefined;
  readonly completedAt?: number | undefined;
  readonly failedAt?: number | undefined;
  readonly error?: JobErrorMetadata | undefined;
}

export interface JobContext<Payload = unknown> {
  readonly job: Readonly<Job<Payload>>;
  readonly payload: Payload;
  readonly signal: AbortSignal;
  readonly attempt: number;
  readonly logger: ILogger;
  readonly progress?: (percent: number, message?: string) => Promise<void> | void;
}

export type JobHandler<Payload = unknown, Result = unknown> = (
  context: JobContext<Payload>
) => Promise<Result> | Result;

export interface JobDefinition<Payload = unknown, Result = unknown> {
  readonly type: string;
  readonly queue?: string | undefined;
  readonly schemaVersion?: number | undefined;
  readonly maxAttempts?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly priority?: JobPriority | undefined;
  readonly retryPolicy?: Partial<RetryPolicy> | undefined;
  readonly handler: JobHandler<Payload, Result>;
}

export interface DispatchOptions {
  readonly queue?: string | undefined;
  readonly delayMs?: number | undefined;
  readonly scheduleAt?: Date | number | undefined;
  readonly priority?: JobPriority | undefined;
  readonly maxAttempts?: number | undefined;
  readonly timeoutMs?: number | undefined;
  readonly retryPolicy?: Partial<RetryPolicy> | undefined;
  readonly schemaVersion?: number | undefined;
}

export interface QueueStats {
  readonly queueName: string;
  readonly pendingCount: number;
  readonly scheduledCount: number;
  readonly processingCount: number;
  readonly completedCount: number;
  readonly failedCount: number;
}

export interface QueueCapabilities {
  readonly supportsPriority: boolean;
  readonly supportsDelayedJobs: boolean;
  readonly supportsVisibilityLease: boolean;
  readonly maxPayloadBytes?: number | undefined;
}

/**
 * Universal Queue Driver interface.
 */
export interface IQueueDriver {
  readonly name: string;
  readonly capabilities: QueueCapabilities;

  enqueue<Payload = unknown>(job: Job<Payload>): Promise<void>;
  claim<Payload = unknown>(
    queueName: string,
    workerId: string,
    leaseTimeoutMs: number,
    count?: number
  ): Promise<Job<Payload>[]>;
  acknowledge(queueName: string, jobId: string): Promise<boolean>;
  release(
    queueName: string,
    jobId: string,
    delayMs?: number,
    error?: JobErrorMetadata
  ): Promise<boolean>;
  fail(queueName: string, jobId: string, error: JobErrorMetadata): Promise<boolean>;
  cancel(queueName: string, jobId: string): Promise<boolean>;
  getJob<Payload = unknown>(queueName: string, jobId: string): Promise<Job<Payload> | undefined>;
  clear(queueName: string): Promise<void>;
  getQueueDepth(queueName: string): Promise<number>;
  getStats(queueName: string): Promise<QueueStats>;
  close(): Promise<void>;
}

export interface WorkerOptions {
  readonly id?: string | undefined;
  readonly queues?: readonly string[] | undefined;
  readonly concurrency?: number | undefined;
  readonly leaseTimeoutMs?: number | undefined;
  readonly pollingIntervalMs?: number | undefined;
  readonly idleBackoffMs?: number | undefined;
  readonly maxIdleBackoffMs?: number | undefined;
  readonly shutdownTimeoutMs?: number | undefined;
  readonly logger?: ILogger | undefined;
}

export interface FailedJob<Payload = unknown> {
  readonly id: string;
  readonly jobId: string;
  readonly jobType: string;
  readonly queue: string;
  readonly payload: Payload;
  readonly error: JobErrorMetadata;
  readonly failedAt: number;
  readonly attempts: number;
}
