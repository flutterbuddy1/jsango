import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryQueueDriver } from '../public/drivers/memory.js';
import { JobRegistry } from '../public/registry.js';
import { Worker } from '../public/worker.js';
import { Queue } from '../public/queue.js';
import { MemoryFailedJobStore } from '../public/failed-jobs.js';

describe('Worker Processing & Lifecycle', () => {
  let driver: MemoryQueueDriver;
  let registry: JobRegistry;
  let failedStore: MemoryFailedJobStore;
  let queue: Queue;
  let worker: Worker;

  beforeEach(() => {
    driver = new MemoryQueueDriver();
    registry = new JobRegistry();
    failedStore = new MemoryFailedJobStore();
    queue = new Queue({ name: 'default', driver });
  });

  afterEach(async () => {
    if (worker && worker.running) {
      await worker.stop();
    }
  });

  it('should process and complete jobs successfully', async () => {
    let executedPayload: unknown;

    registry.register({
      type: 'emails.welcome',
      handler: async (ctx) => {
        executedPayload = ctx.payload;
      },
    });

    await queue.dispatch('emails.welcome', { user: 'Alice' });

    worker = new Worker(
      driver,
      registry,
      { pollingIntervalMs: 10, idleBackoffMs: 20 },
      failedStore
    );
    worker.start();

    const start = Date.now();
    while ((await queue.depth()) > 0 && Date.now() - start < 1500) {
      await new Promise((r) => setTimeout(r, 15));
    }

    expect(executedPayload).toEqual({ user: 'Alice' });
    expect(await queue.depth()).toBe(0);
  });

  it('should strictly enforce worker concurrency limit', async () => {
    let currentConcurrent = 0;
    let maxObservedConcurrent = 0;

    registry.register({
      type: 'slow.job',
      handler: async () => {
        currentConcurrent++;
        maxObservedConcurrent = Math.max(maxObservedConcurrent, currentConcurrent);
        await new Promise((r) => setTimeout(r, 20));
        currentConcurrent--;
      },
    });

    // Enqueue 10 slow jobs
    for (let i = 0; i < 10; i++) {
      await queue.dispatch('slow.job', { i });
    }

    // Set concurrency to 3
    worker = new Worker(
      driver,
      registry,
      { concurrency: 3, pollingIntervalMs: 10, idleBackoffMs: 20 },
      failedStore
    );
    worker.start();

    const start = Date.now();
    while ((await queue.depth()) > 0 && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(maxObservedConcurrent).toBeLessThanOrEqual(3);
    expect(await queue.depth()).toBe(0);
  });

  it('should retry failed jobs up to maxAttempts and then record in failedJobStore', async () => {
    let attemptCount = 0;

    registry.register({
      type: 'always.fails',
      maxAttempts: 2,
      retryPolicy: {
        maxAttempts: 2,
        backoffType: 'fixed',
        initialDelayMs: 10,
        jitter: false,
      },
      handler: async () => {
        attemptCount++;
        throw new Error('Fatal error for job');
      },
    });

    const jobId = await queue.dispatch('always.fails', { id: 123 }, { maxAttempts: 2 });

    worker = new Worker(
      driver,
      registry,
      { pollingIntervalMs: 10, idleBackoffMs: 20 },
      failedStore
    );
    worker.start();

    const start = Date.now();
    while (attemptCount < 2 && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 20));
    }

    // Wait until job is recorded in failedStore
    while ((await failedStore.count()) === 0 && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(attemptCount).toBe(2);

    const failedList = await failedStore.list();
    expect(failedList.length).toBe(1);
    expect(failedList[0]?.jobId).toBe(jobId);
    expect(failedList[0]?.error.message).toBe('Fatal error for job');
    expect(failedList[0]?.attempts).toBe(2);
  });

  it('should abort and fail job when execution exceeds timeoutMs', async () => {
    let wasAborted = false;

    registry.register({
      type: 'timeout.job',
      handler: async (ctx) => {
        await new Promise((_, reject) => {
          ctx.signal.addEventListener('abort', () => {
            wasAborted = true;
            reject(new Error('Job aborted'));
          });
        });
      },
    });

    await queue.dispatch('timeout.job', {}, { timeoutMs: 30, maxAttempts: 1 });

    worker = new Worker(
      driver,
      registry,
      { pollingIntervalMs: 10, idleBackoffMs: 20 },
      failedStore
    );
    worker.start();

    const start = Date.now();
    while ((await failedStore.count()) === 0 && Date.now() - start < 2000) {
      await new Promise((r) => setTimeout(r, 20));
    }

    expect(wasAborted).toBe(true);
    const failedList = await failedStore.list();
    expect(failedList.length).toBe(1);
    expect(failedList[0]?.error.errorType).toBe('JobTimeoutError');
  });
});
