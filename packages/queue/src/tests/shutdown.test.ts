import { describe, it, expect } from 'vitest';
import { MemoryQueueDriver } from '../public/drivers/memory.js';
import { JobRegistry } from '../public/registry.js';
import { Worker } from '../public/worker.js';
import { Queue } from '../public/queue.js';

describe('Worker Graceful Shutdown', () => {
  it('should allow in-flight jobs to complete during shutdown', async () => {
    const driver = new MemoryQueueDriver();
    const registry = new JobRegistry();
    const queue = new Queue({ name: 'default', driver });

    let jobCompleted = false;

    registry.register({
      type: 'in-flight.job',
      handler: async () => {
        await new Promise((r) => setTimeout(r, 40));
        jobCompleted = true;
      },
    });

    await queue.dispatch('in-flight.job', {});

    const worker = new Worker(driver, registry, {
      pollingIntervalMs: 10,
      shutdownTimeoutMs: 1000,
    });
    worker.start();

    // Give it a tiny moment to claim and start processing the job
    await new Promise((r) => setTimeout(r, 15));

    // Immediately trigger stop
    await worker.stop();

    // The in-flight job should have successfully completed before stop returned
    expect(jobCompleted).toBe(true);
    expect(worker.running).toBe(false);
  });
});
