import { describe, bench, beforeAll } from 'vitest';
import {
  MemoryQueueDriver,
  Queue,
  JobRegistry,
  RetryCalculator,
  QueueManager,
  type RetryPolicy,
} from '../../packages/queue/src/index.js';

// Setup: shared driver and queue
const driver = new MemoryQueueDriver();
const queue = new Queue({ name: 'bench', driver });
const registry = new JobRegistry();
const manager = new QueueManager({
  default: 'default',
  connections: { default: { driver: 'memory' } },
});

// Register a simple job type
registry.register({
  type: 'bench.job',
  handler: async () => 'done',
});

manager.registerJob({
  type: 'bench.task',
  handler: async () => 'processed',
});

// Pre-populate some jobs for claim benchmarks
beforeAll(async () => {
  for (let i = 0; i < 100; i++) {
    await queue.dispatch('bench.job', { index: i });
  }
});

describe('Queue Benchmarks', () => {
  // --- Raw Driver Operations ---

  describe('MemoryQueueDriver', () => {
    let counter = 0;

    bench('enqueue (single job)', async () => {
      await driver.enqueue({
        id: `driver-bench-${counter++}`,
        type: 'bench.job',
        queue: 'bench-raw',
        payload: { value: counter },
        schemaVersion: 1,
        status: 'pending',
        priority: 0,
        attempt: 0,
        maxAttempts: 3,
        timeoutMs: 30_000,
        retryPolicy: {
          maxAttempts: 3,
          backoffType: 'exponential',
          initialDelayMs: 1000,
        },
        createdAt: Date.now(),
        scheduledAt: Date.now(),
      });
    });

    bench('claim (single job)', async () => {
      // Ensure there's a job to claim
      await driver.enqueue({
        id: `claim-bench-${counter++}`,
        type: 'bench.job',
        queue: 'claim-queue',
        payload: {},
        schemaVersion: 1,
        status: 'pending',
        priority: 0,
        attempt: 0,
        maxAttempts: 3,
        timeoutMs: 30_000,
        retryPolicy: {
          maxAttempts: 3,
          backoffType: 'exponential',
          initialDelayMs: 1000,
        },
        createdAt: Date.now(),
        scheduledAt: Date.now(),
      });
      await driver.claim('claim-queue', 'bench-worker', 30_000, 1);
    });

    bench('acknowledge', async () => {
      const id = `ack-bench-${counter++}`;
      await driver.enqueue({
        id,
        type: 'bench.job',
        queue: 'ack-queue',
        payload: {},
        schemaVersion: 1,
        status: 'pending',
        priority: 0,
        attempt: 0,
        maxAttempts: 3,
        timeoutMs: 30_000,
        retryPolicy: {
          maxAttempts: 3,
          backoffType: 'exponential',
          initialDelayMs: 1000,
        },
        createdAt: Date.now(),
        scheduledAt: Date.now(),
      });
      await driver.claim('ack-queue', 'bench-worker', 30_000, 1);
      await driver.acknowledge('ack-queue', id);
    });

    bench('getStats', async () => {
      await driver.getStats('bench-raw');
    });

    bench('getQueueDepth', async () => {
      await driver.getQueueDepth('bench-raw');
    });
  });

  // --- Queue (high-level) ---

  describe('Queue', () => {
    let queueCounter = 0;

    bench('dispatch (typed job)', async () => {
      await queue.dispatch('bench.job', { index: queueCounter++ });
    });

    bench('delay (1s delay)', async () => {
      await queue.delay('bench.job', { index: queueCounter++ }, 1000);
    });

    bench('schedule (future date)', async () => {
      await queue.schedule('bench.job', { index: queueCounter++ }, Date.now() + 60_000);
    });

    bench('depth', async () => {
      await queue.depth();
    });

    bench('stats', async () => {
      await queue.stats();
    });
  });

  // --- RetryCalculator ---

  describe('RetryCalculator', () => {
    const exponentialPolicy: RetryPolicy = {
      maxAttempts: 5,
      backoffType: 'exponential',
      initialDelayMs: 1000,
      maxDelayMs: 60_000,
      jitter: true,
    };

    const fixedPolicy: RetryPolicy = {
      maxAttempts: 3,
      backoffType: 'fixed',
      initialDelayMs: 5000,
    };

    bench('shouldRetry (within limit)', () => {
      RetryCalculator.shouldRetry(2, 5);
    });

    bench('calculateDelay (exponential + jitter)', () => {
      RetryCalculator.calculateDelay(exponentialPolicy, 3);
    });

    bench('calculateDelay (fixed)', () => {
      RetryCalculator.calculateDelay(fixedPolicy, 2);
    });
  });

  // --- JobRegistry ---

  describe('JobRegistry', () => {
    bench('resolve (registered type)', () => {
      registry.resolve('bench.job');
    });
  });

  // --- QueueManager (full stack) ---

  describe('QueueManager', () => {
    let managerCounter = 0;

    bench('dispatch (via manager)', async () => {
      await manager.dispatch('bench.task', { val: managerCounter++ });
    });

    bench('queue() resolution (cached)', () => {
      manager.queue('default');
    });
  });
});
