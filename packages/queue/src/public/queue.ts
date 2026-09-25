import type {
  DispatchOptions,
  IQueueDriver,
  Job,
  JobPriority,
  QueueStats,
  RetryPolicy,
} from './types.js';
import { JobSerializationError } from './errors.js';
import { generateJobId } from './id.js';
import { DEFAULT_RETRY_POLICY } from './retry.js';

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
export class Queue {
  public readonly name: string;
  public readonly driver: IQueueDriver;
  private readonly defaultMaxAttempts: number;
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetryPolicy: RetryPolicy;

  constructor(options: QueueOptions) {
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
  public async dispatch<Payload = unknown>(
    type: string,
    payload: Payload,
    options: DispatchOptions = {}
  ): Promise<string> {
    this.validatePayload(payload);

    const now = Date.now();
    let scheduledAt = now;

    if (options.delayMs !== undefined && options.delayMs > 0) {
      scheduledAt = now + options.delayMs;
    } else if (options.scheduleAt !== undefined) {
      scheduledAt =
        options.scheduleAt instanceof Date ? options.scheduleAt.getTime() : options.scheduleAt;
    }

    const priority = this.resolvePriority(options.priority);
    const retryPolicy: RetryPolicy = {
      ...this.defaultRetryPolicy,
      ...(options.retryPolicy ?? {}),
      maxAttempts: options.maxAttempts ?? this.defaultMaxAttempts,
    };

    const jobId = generateJobId();
    const job: Job<Payload> = {
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
  public async delay<Payload = unknown>(
    type: string,
    payload: Payload,
    delayMs: number,
    options: DispatchOptions = {}
  ): Promise<string> {
    return this.dispatch(type, payload, { ...options, delayMs });
  }

  /**
   * Schedules a job for future execution at a specific Date or timestamp.
   */
  public async schedule<Payload = unknown>(
    type: string,
    payload: Payload,
    scheduleAt: Date | number,
    options: DispatchOptions = {}
  ): Promise<string> {
    return this.dispatch(type, payload, { ...options, scheduleAt });
  }

  /**
   * Enqueues an already prepared Job model.
   */
  public async enqueue<Payload = unknown>(job: Job<Payload>): Promise<void> {
    this.validatePayload(job.payload);
    await this.driver.enqueue(job);
  }

  /**
   * Cancels a pending or scheduled job.
   */
  public async cancel(jobId: string): Promise<boolean> {
    return this.driver.cancel(this.name, jobId);
  }

  /**
   * Retrieves a job by ID.
   */
  public async getJob<Payload = unknown>(jobId: string): Promise<Job<Payload> | undefined> {
    return this.driver.getJob<Payload>(this.name, jobId);
  }

  /**
   * Clears all jobs in this queue.
   */
  public async clear(): Promise<void> {
    await this.driver.clear(this.name);
  }

  /**
   * Returns current pending and scheduled queue depth.
   */
  public async depth(): Promise<number> {
    return this.driver.getQueueDepth(this.name);
  }

  /**
   * Returns queue statistics.
   */
  public async stats(): Promise<QueueStats> {
    return this.driver.getStats(this.name);
  }

  private resolvePriority(priority?: JobPriority): number {
    if (typeof priority === 'number') {
      return priority;
    }
    if (priority === 'high') return 10;
    if (priority === 'normal') return 5;
    if (priority === 'low') return 1;
    return 5;
  }

  private validatePayload(payload: unknown): void {
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
    } catch (err) {
      if (err instanceof JobSerializationError) {
        throw err;
      }
      throw new JobSerializationError(
        `Job payload is not serializable: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }
}
