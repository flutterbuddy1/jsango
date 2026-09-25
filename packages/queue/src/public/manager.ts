import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';
import type { DispatchOptions, IQueueDriver, JobDefinition, WorkerOptions } from './types.js';
import { QueueError } from './errors.js';
import { Queue } from './queue.js';
import { JobRegistry } from './registry.js';
import { Worker } from './worker.js';
import { MemoryQueueDriver } from './drivers/memory.js';
import { type IFailedJobStore, MemoryFailedJobStore } from './failed-jobs.js';

export interface QueueConnectionConfig {
  readonly driver: string;
  readonly options?: Readonly<Record<string, unknown>> | undefined;
}

export interface QueueConfig {
  readonly default: string;
  readonly connections: Readonly<Record<string, QueueConnectionConfig>>;
  readonly workers?:
    | {
        readonly concurrency?: number | undefined;
        readonly leaseTimeoutMs?: number | undefined;
        readonly pollingIntervalMs?: number | undefined;
      }
    | undefined;
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
export class QueueManager {
  private readonly config: QueueConfig;
  public readonly logger: ILogger;
  public readonly registry: JobRegistry;
  public readonly failedJobStore: IFailedJobStore;

  private readonly driverFactories = new Map<string, QueueDriverFactory>();
  private readonly driverInstances = new Map<string, IQueueDriver>();
  private readonly queues = new Map<string, Queue>();
  private readonly activeWorkers = new Set<Worker>();
  private closed = false;

  constructor(config?: Partial<QueueConfig>, options: QueueManagerOptions = {}) {
    this.logger = options.logger ?? new NoopLogger();
    this.registry = options.registry ?? new JobRegistry();
    this.failedJobStore = options.failedJobStore ?? new MemoryFailedJobStore();

    this.config = {
      default: config?.default ?? 'default',
      connections: config?.connections ?? {
        default: { driver: 'memory' },
      },
      workers: config?.workers,
    };

    // Register memory driver factory by default
    this.registerDriver('memory', () => new MemoryQueueDriver());
  }

  public registerDriver(name: string, factory: QueueDriverFactory | IQueueDriver): this {
    const normalized = name.toLowerCase();
    if (typeof factory === 'function') {
      this.driverFactories.set(normalized, factory);
    } else {
      this.driverFactories.set(normalized, () => factory);
    }
    return this;
  }

  public getDriver(connectionName?: string): IQueueDriver {
    this.assertNotClosed();
    const conn = connectionName ?? this.config.default;

    const existing = this.driverInstances.get(conn);
    if (existing) {
      return existing;
    }

    const connConfig = this.config.connections[conn];
    if (!connConfig) {
      throw new QueueError({
        code: 'ERR_QUEUE_CONNECTION_NOT_CONFIGURED',
        message: `Queue connection "${conn}" is not configured in QueueConfig.`,
        metadata: { connection: conn },
        statusCode: 500,
      });
    }

    const factory = this.driverFactories.get(connConfig.driver.toLowerCase());
    if (!factory) {
      throw new QueueError({
        code: 'ERR_QUEUE_DRIVER_NOT_FOUND',
        message: `Queue driver "${connConfig.driver}" for connection "${conn}" is not registered.`,
        metadata: { connection: conn, driver: connConfig.driver },
        statusCode: 500,
      });
    }

    const driver = factory(connConfig);
    this.driverInstances.set(conn, driver);
    return driver;
  }

  /**
   * Retrieves or creates a named Queue handle.
   */
  public queue(queueName = 'default', connectionName?: string): Queue {
    this.assertNotClosed();
    const cacheKey = `${connectionName ?? this.config.default}:${queueName}`;

    const existing = this.queues.get(cacheKey);
    if (existing) {
      return existing;
    }

    const driver = this.getDriver(connectionName);
    const queue = new Queue({
      name: queueName,
      driver,
    });

    this.queues.set(cacheKey, queue);
    return queue;
  }

  /**
   * Convenience method: registers a job type definition into the manager's registry.
   */
  public registerJob<Payload = unknown, Result = unknown>(
    definition: JobDefinition<Payload, Result>
  ): this {
    this.registry.register(definition);
    return this;
  }

  /**
   * Convenience method: dispatches a job to the default queue.
   */
  public async dispatch<Payload = unknown>(
    type: string,
    payload: Payload,
    options?: DispatchOptions
  ): Promise<string> {
    const queueName = options?.queue ?? 'default';
    return this.queue(queueName).dispatch(type, payload, options);
  }

  /**
   * Convenience method: delays a job on the default queue.
   */
  public async delay<Payload = unknown>(
    type: string,
    payload: Payload,
    delayMs: number,
    options?: DispatchOptions
  ): Promise<string> {
    const queueName = options?.queue ?? 'default';
    return this.queue(queueName).delay(type, payload, delayMs, options);
  }

  /**
   * Convenience method: schedules a job on the default queue.
   */
  public async schedule<Payload = unknown>(
    type: string,
    payload: Payload,
    at: Date | number,
    options?: DispatchOptions
  ): Promise<string> {
    const queueName = options?.queue ?? 'default';
    return this.queue(queueName).schedule(type, payload, at, options);
  }

  /**
   * Creates a Worker instance configured with the manager's driver and registry.
   */
  public createWorker(options: WorkerOptions = {}): Worker {
    this.assertNotClosed();
    const driver = this.getDriver();
    const mergedOptions: WorkerOptions = {
      concurrency: options.concurrency ?? this.config.workers?.concurrency,
      leaseTimeoutMs: options.leaseTimeoutMs ?? this.config.workers?.leaseTimeoutMs,
      pollingIntervalMs: options.pollingIntervalMs ?? this.config.workers?.pollingIntervalMs,
      logger: this.logger,
      ...options,
    };

    const worker = new Worker(driver, this.registry, mergedOptions, this.failedJobStore);
    this.activeWorkers.add(worker);
    return worker;
  }

  /**
   * Creates and immediately starts a Worker instance.
   */
  public startWorker(options: WorkerOptions = {}): Worker {
    const worker = this.createWorker(options);
    worker.start();
    return worker;
  }

  /**
   * Gracefully shuts down all active workers and closes all queue driver connections.
   */
  public async close(): Promise<void> {
    if (this.closed) {
      return;
    }
    this.closed = true;

    // Stop all active workers in parallel
    const workerStops = [...this.activeWorkers].map((w) => w.stop());
    await Promise.all(workerStops);
    this.activeWorkers.clear();

    // Close all drivers
    const driverCloses = [...this.driverInstances.values()].map((d) => d.close());
    await Promise.all(driverCloses);
    this.driverInstances.clear();
    this.queues.clear();
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new QueueError({
        code: 'ERR_QUEUE_MANAGER_CLOSED',
        message: 'QueueManager has already been closed.',
        statusCode: 500,
      });
    }
  }
}
