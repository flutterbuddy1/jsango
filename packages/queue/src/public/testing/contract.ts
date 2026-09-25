import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { IQueueDriver, Job } from '../types.js';
import { generateJobId } from '../id.js';
import { DEFAULT_RETRY_POLICY } from '../retry.js';

export interface QueueDriverTestContext {
  driver: IQueueDriver;
  cleanup?: () => Promise<void> | void;
}

export function runQueueDriverContractTests(
  driverName: string,
  createDriver: () => Promise<QueueDriverTestContext> | QueueDriverTestContext
): void {
  describe(`IQueueDriver Contract: ${driverName}`, () => {
    let driver: IQueueDriver;
    let cleanupFn: (() => Promise<void> | void) | undefined;
    const testQueue = 'test-queue';

    beforeEach(async () => {
      const ctx = await createDriver();
      driver = ctx.driver;
      cleanupFn = ctx.cleanup;
      await driver.clear(testQueue);
    });

    afterEach(async () => {
      await driver.clear(testQueue);
      await driver.close();
      if (cleanupFn) {
        await cleanupFn();
      }
    });

    function createDummyJob(overrides: Partial<Job> = {}): Job {
      const now = Date.now();
      return {
        id: generateJobId(),
        type: 'test.job',
        queue: testQueue,
        payload: { message: 'hello' },
        schemaVersion: 1,
        status: 'pending',
        priority: 5,
        attempt: 0,
        maxAttempts: 3,
        timeoutMs: 30000,
        retryPolicy: DEFAULT_RETRY_POLICY,
        createdAt: now,
        scheduledAt: now,
        ...overrides,
      };
    }

    it('should enqueue and retrieve jobs', async () => {
      const job = createDummyJob();
      await driver.enqueue(job);

      const fetched = await driver.getJob(testQueue, job.id);
      expect(fetched).toBeDefined();
      expect(fetched?.id).toBe(job.id);
      expect(fetched?.type).toBe(job.type);
    });

    it('should claim pending jobs with visibility lease', async () => {
      const job = createDummyJob();
      await driver.enqueue(job);

      const claimed = await driver.claim(testQueue, 'worker-1', 1000, 1);
      expect(claimed.length).toBe(1);
      expect(claimed[0]?.id).toBe(job.id);
      expect(claimed[0]?.status).toBe('processing');
      expect(claimed[0]?.attempt).toBe(1);

      // Subsequent claim before lease expires should return empty
      const secondClaim = await driver.claim(testQueue, 'worker-2', 1000, 1);
      expect(secondClaim.length).toBe(0);
    });

    it('should respect job priority during claim (high before low)', async () => {
      const low = createDummyJob({ id: 'low-job', priority: 1 });
      const high = createDummyJob({ id: 'high-job', priority: 10 });
      const normal = createDummyJob({ id: 'normal-job', priority: 5 });

      await driver.enqueue(low);
      await driver.enqueue(high);
      await driver.enqueue(normal);

      const claimed = await driver.claim(testQueue, 'worker-1', 1000, 3);
      expect(claimed.length).toBe(3);
      expect(claimed[0]?.id).toBe('high-job');
      expect(claimed[1]?.id).toBe('normal-job');
      expect(claimed[2]?.id).toBe('low-job');
    });

    it('should not claim scheduled jobs until their scheduled time has arrived', async () => {
      const futureTime = Date.now() + 5000;
      const scheduledJob = createDummyJob({
        status: 'scheduled',
        scheduledAt: futureTime,
      });

      await driver.enqueue(scheduledJob);

      const claimed = await driver.claim(testQueue, 'worker-1', 1000, 1);
      expect(claimed.length).toBe(0);
    });

    it('should recover leased jobs after leaseTimeout expires', async () => {
      const job = createDummyJob();
      await driver.enqueue(job);

      // Claim with very short lease (30ms)
      const claimed = await driver.claim(testQueue, 'crashed-worker', 30, 1);
      expect(claimed.length).toBe(1);

      // Wait for lease to expire
      await new Promise((r) => setTimeout(r, 60));

      // Worker 2 can now claim the orphaned job
      const recovered = await driver.claim(testQueue, 'recovery-worker', 1000, 1);
      expect(recovered.length).toBe(1);
      expect(recovered[0]?.id).toBe(job.id);
      expect(recovered[0]?.attempt).toBe(2);
    });

    it('should acknowledge and remove successfully completed jobs', async () => {
      const job = createDummyJob();
      await driver.enqueue(job);

      const claimed = await driver.claim(testQueue, 'worker-1', 1000, 1);
      expect(claimed.length).toBe(1);

      const acked = await driver.acknowledge(testQueue, job.id);
      expect(acked).toBe(true);

      const check = await driver.getJob(testQueue, job.id);
      expect(check).toBeUndefined();
    });

    it('should release jobs back to queue with optional retry delay', async () => {
      const job = createDummyJob();
      await driver.enqueue(job);

      await driver.claim(testQueue, 'worker-1', 1000, 1);
      const released = await driver.release(testQueue, job.id, 0);
      expect(released).toBe(true);

      const updated = await driver.getJob(testQueue, job.id);
      expect(updated?.status).toBe('pending');
      expect(updated?.lockedAt).toBeUndefined();
    });

    it('should mark jobs as failed', async () => {
      const job = createDummyJob();
      await driver.enqueue(job);

      await driver.claim(testQueue, 'worker-1', 1000, 1);
      const failed = await driver.fail(testQueue, job.id, {
        errorType: 'CustomError',
        message: 'Fatal error occurred',
        failedAt: Date.now(),
        attempt: 1,
      });
      expect(failed).toBe(true);

      const updated = await driver.getJob(testQueue, job.id);
      expect(updated?.status).toBe('failed');
      expect(updated?.error?.message).toBe('Fatal error occurred');
    });

    it('should report queue depth and stats accurately', async () => {
      const j1 = createDummyJob();
      const j2 = createDummyJob();
      await driver.enqueue(j1);
      await driver.enqueue(j2);

      const depth = await driver.getQueueDepth(testQueue);
      expect(depth).toBe(2);

      const stats = await driver.getStats(testQueue);
      expect(stats.pendingCount).toBe(2);
      expect(stats.processingCount).toBe(0);
    });
  });
}
