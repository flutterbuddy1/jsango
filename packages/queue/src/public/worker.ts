import type { ILogger } from '@django-js/core';
import { NoopLogger } from '@django-js/core';
import type { IQueueDriver, Job, JobContext, JobErrorMetadata, WorkerOptions } from './types.js';
import { JobTimeoutError } from './errors.js';
import type { JobRegistry } from './registry.js';
import { RetryCalculator } from './retry.js';
import type { IFailedJobStore } from './failed-jobs.js';
import { QueueMiddlewarePipeline, type QueueMiddlewareHandler } from './middleware.js';
import { generateJobId } from './id.js';

export type JobLifecycleHook = (
  job: Readonly<Job<unknown>>,
  metadata?: Record<string, unknown>
) => Promise<void> | void;

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
export class Worker {
  public readonly id: string;
  public readonly driver: IQueueDriver;
  public readonly registry: JobRegistry;
  public readonly queues: readonly string[];
  public readonly concurrency: number;
  public readonly leaseTimeoutMs: number;
  public readonly pollingIntervalMs: number;
  public readonly idleBackoffMs: number;
  public readonly maxIdleBackoffMs: number;
  public readonly shutdownTimeoutMs: number;
  public readonly logger: ILogger;
  public readonly failedJobStore?: IFailedJobStore | undefined;
  public readonly middlewarePipeline: QueueMiddlewarePipeline;

  private isRunning = false;
  private isStopping = false;
  private currentIdleDelay: number;
  private readonly activeJobs = new Map<string, Promise<void>>();
  private loopPromise?: Promise<void> | undefined;
  private stopResolve?: () => void;
  private hooks: WorkerHooks = {};

  constructor(
    driver: IQueueDriver,
    registry: JobRegistry,
    options: WorkerOptions = {},
    failedJobStore?: IFailedJobStore
  ) {
    this.driver = driver;
    this.registry = registry;
    this.failedJobStore = failedJobStore;
    this.id = options.id ?? `worker-${generateJobId().slice(0, 8)}`;
    this.queues = options.queues && options.queues.length > 0 ? options.queues : ['default'];
    this.concurrency = Math.max(1, options.concurrency ?? 5);
    this.leaseTimeoutMs = options.leaseTimeoutMs ?? 60_000;
    this.pollingIntervalMs = options.pollingIntervalMs ?? 100;
    this.idleBackoffMs = options.idleBackoffMs ?? 500;
    this.maxIdleBackoffMs = options.maxIdleBackoffMs ?? 5000;
    this.shutdownTimeoutMs = options.shutdownTimeoutMs ?? 15_000;
    this.logger = options.logger ?? new NoopLogger();
    this.currentIdleDelay = this.idleBackoffMs;
    this.middlewarePipeline = new QueueMiddlewarePipeline();
  }

  public get running(): boolean {
    return this.isRunning;
  }

  public get activeCount(): number {
    return this.activeJobs.size;
  }

  public setHooks(hooks: WorkerHooks): this {
    this.hooks = { ...this.hooks, ...hooks };
    return this;
  }

  public use(handler: QueueMiddlewareHandler): this {
    this.middlewarePipeline.use(handler);
    return this;
  }

  /**
   * Starts the background worker processing loop.
   */
  public start(): this {
    if (this.isRunning) {
      return this;
    }

    this.isRunning = true;
    this.isStopping = false;
    this.logger.info(`Worker [${this.id}] started listening on queues: ${this.queues.join(', ')}`, {
      concurrency: this.concurrency,
      workerId: this.id,
    });

    this.loopPromise = this.runLoop();
    return this;
  }

  /**
   * Executes a single processing pass across all configured queues (useful for CLI and testing).
   */
  public async runOnce(): Promise<number> {
    let processedCount = 0;

    for (const queueName of this.queues) {
      const availableCapacity = this.concurrency - this.activeJobs.size;
      if (availableCapacity <= 0) break;

      const jobs = await this.driver.claim(
        queueName,
        this.id,
        this.leaseTimeoutMs,
        availableCapacity
      );

      for (const job of jobs) {
        await this.processJob(job);
        processedCount++;
      }
    }

    return processedCount;
  }

  /**
   * Initiates graceful shutdown: stops polling, allows in-flight jobs to complete,
   * and exits within shutdownTimeoutMs.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning || this.isStopping) {
      return;
    }

    this.isStopping = true;
    this.logger.info(
      `Worker [${this.id}] stopping gracefully. Active jobs: ${this.activeJobs.size}`
    );

    // Break the loop
    if (this.stopResolve) {
      this.stopResolve();
    }

    // Wait for worker loop to terminate
    if (this.loopPromise) {
      await this.loopPromise;
    }

    // Wait for in-flight jobs to finish with timeout protection
    if (this.activeJobs.size > 0) {
      const activePromises = Promise.all([...this.activeJobs.values()]);
      let timeoutId: NodeJS.Timeout | undefined;

      const timeoutPromise = new Promise<void>((resolve) => {
        timeoutId = setTimeout(() => {
          this.logger.warn(
            `Worker [${this.id}] shutdown timeout exceeded (${this.shutdownTimeoutMs}ms). Forcing exit.`
          );
          resolve();
        }, this.shutdownTimeoutMs);
      });

      await Promise.race([activePromises, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
    }

    this.isRunning = false;
    this.logger.info(`Worker [${this.id}] stopped successfully.`);
  }

  private async runLoop(): Promise<void> {
    while (this.isRunning && !this.isStopping) {
      try {
        let claimedAny = false;

        for (const queueName of this.queues) {
          if (this.isStopping) break;

          const availableCapacity = this.concurrency - this.activeJobs.size;
          if (availableCapacity <= 0) {
            break;
          }

          const jobs = await this.driver.claim(
            queueName,
            this.id,
            this.leaseTimeoutMs,
            availableCapacity
          );

          if (jobs.length > 0) {
            claimedAny = true;
            for (const job of jobs) {
              const jobPromise = this.processJob(job).finally(() => {
                this.activeJobs.delete(job.id);
              });
              this.activeJobs.set(job.id, jobPromise);
            }
          }
        }

        if (claimedAny) {
          // Reset idle delay on work found
          this.currentIdleDelay = this.idleBackoffMs;
          await this.delay(this.pollingIntervalMs);
        } else {
          // Idle backoff when no jobs are present
          await this.delay(this.currentIdleDelay);
          this.currentIdleDelay = Math.min(this.currentIdleDelay * 1.5, this.maxIdleBackoffMs);
        }
      } catch (err) {
        this.logger.error(`Worker [${this.id}] error in processing loop`, {
          error: err instanceof Error ? err.message : String(err),
        });
        await this.delay(this.currentIdleDelay);
      }
    }
  }

  private async processJob(job: Job<unknown>): Promise<void> {
    const definition = this.registry.get(job.type);

    if (!definition) {
      const errMeta: JobErrorMetadata = {
        errorType: 'JobNotFoundError',
        message: `No handler registered for job type "${job.type}".`,
        failedAt: Date.now(),
        attempt: job.attempt,
      };

      this.logger.error(`Unknown job type "${job.type}" [${job.id}]`, errMeta);
      await this.handlePermanentFailure(job, errMeta);
      return;
    }

    const abortController = new AbortController();
    let timeoutId: NodeJS.Timeout | undefined;

    if (job.timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        abortController.abort(new JobTimeoutError(job.id, job.type, job.timeoutMs));
      }, job.timeoutMs);
    }

    const context: JobContext<unknown> = {
      job,
      payload: job.payload,
      signal: abortController.signal,
      attempt: job.attempt,
      logger: this.logger,
    };

    try {
      if (this.hooks.onJobStarted) {
        await this.hooks.onJobStarted(job);
      }

      // Execute via middleware pipeline
      await this.middlewarePipeline.execute(context, async () => {
        if (context.signal.aborted) {
          throw new JobTimeoutError(job.id, job.type, job.timeoutMs);
        }
        await definition.handler(context);
        if (context.signal.aborted) {
          throw new JobTimeoutError(job.id, job.type, job.timeoutMs);
        }
      });

      if (context.signal.aborted) {
        throw new JobTimeoutError(job.id, job.type, job.timeoutMs);
      }

      if (timeoutId) clearTimeout(timeoutId);

      // Acknowledge success
      await this.driver.acknowledge(job.queue, job.id);

      if (this.hooks.onJobCompleted) {
        await this.hooks.onJobCompleted(job);
      }

      this.logger.info(`Job completed: ${job.type} [${job.id}]`, {
        jobId: job.id,
        jobType: job.type,
        queue: job.queue,
        attempt: job.attempt,
      });
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);

      const isTimeout = context.signal.aborted || err instanceof JobTimeoutError;
      const errorType = isTimeout
        ? 'JobTimeoutError'
        : err instanceof Error
          ? err.name
          : 'UnknownError';
      const errorMessage = isTimeout
        ? `Job "${job.type}" [${job.id}] timed out after ${job.timeoutMs}ms.`
        : err instanceof Error
          ? err.message
          : String(err);
      const errorStack = err instanceof Error ? err.stack : undefined;

      const errorMeta: JobErrorMetadata = {
        errorType,
        message: errorMessage,
        stack: errorStack,
        failedAt: Date.now(),
        attempt: job.attempt,
      };

      this.logger.error(
        `Job failed: ${job.type} [${job.id}] (Attempt ${job.attempt}/${job.maxAttempts})`,
        {
          jobId: job.id,
          jobType: job.type,
          error: errorMessage,
          attempt: job.attempt,
        }
      );

      const shouldRetry = RetryCalculator.shouldRetry(job.attempt, job.maxAttempts);

      if (shouldRetry) {
        const delayMs = RetryCalculator.calculateDelay(job.retryPolicy, job.attempt);
        await this.driver.release(job.queue, job.id, delayMs, errorMeta);

        if (this.hooks.onJobRetried) {
          await this.hooks.onJobRetried(job, { delayMs, attempt: job.attempt });
        }
      } else {
        await this.handlePermanentFailure(job, errorMeta);
      }
    }
  }

  private async handlePermanentFailure(job: Job<unknown>, error: JobErrorMetadata): Promise<void> {
    await this.driver.fail(job.queue, job.id, error);

    if (this.failedJobStore) {
      await this.failedJobStore.record({
        id: generateJobId(),
        jobId: job.id,
        jobType: job.type,
        queue: job.queue,
        payload: job.payload,
        error,
        failedAt: error.failedAt,
        attempts: job.attempt,
      });
    }

    if (this.hooks.onJobFailed) {
      await this.hooks.onJobFailed(job, { error });
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer: NodeJS.Timeout = setTimeout(() => {
        resolve();
      }, ms);

      const onStop = () => {
        clearTimeout(timer);
        resolve();
      };

      this.stopResolve = onStop;
    });
  }
}
