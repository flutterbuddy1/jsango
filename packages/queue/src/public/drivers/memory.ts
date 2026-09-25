import type {
  IQueueDriver,
  Job,
  JobErrorMetadata,
  QueueCapabilities,
  QueueStats,
} from '../types.js';

/**
 * Deterministic In-Memory Queue Driver supporting priority ordering,
 * scheduled/delayed execution, and visibility leases.
 */
export class MemoryQueueDriver implements IQueueDriver {
  public readonly name = 'memory';
  public readonly capabilities: QueueCapabilities = {
    supportsPriority: true,
    supportsDelayedJobs: true,
    supportsVisibilityLease: true,
    maxPayloadBytes: 10 * 1024 * 1024,
  };

  // queueName -> jobId -> Job
  private readonly queues = new Map<string, Map<string, Job<unknown>>>();

  public async enqueue<Payload = unknown>(job: Job<Payload>): Promise<void> {
    const queueMap = this.getOrCreateQueue(job.queue);
    queueMap.set(job.id, job as Job<unknown>);
  }

  public async claim<Payload = unknown>(
    queueName: string,
    workerId: string,
    leaseTimeoutMs: number,
    count = 1
  ): Promise<Job<Payload>[]> {
    const queueMap = this.getOrCreateQueue(queueName);
    const now = Date.now();
    const claimable: Job<unknown>[] = [];

    for (const job of queueMap.values()) {
      if (job.status === 'completed' || job.status === 'cancelled' || job.status === 'failed') {
        continue;
      }

      // Check if job is pending
      if (job.status === 'pending') {
        claimable.push(job);
        continue;
      }

      // Check if scheduled job is now ready
      if (job.status === 'scheduled' && job.scheduledAt <= now) {
        claimable.push(job);
        continue;
      }

      // Check if leased job has expired (worker crash recovery)
      if (job.status === 'processing' && job.lockedUntil !== undefined && now >= job.lockedUntil) {
        claimable.push(job);
      }
    }

    if (claimable.length === 0) {
      return [];
    }

    // Sort by priority descending (higher first), then scheduledAt/createdAt ascending (FIFO)
    claimable.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return (a.scheduledAt || a.createdAt) - (b.scheduledAt || b.createdAt);
    });

    const selected = claimable.slice(0, count);
    const claimed: Job<Payload>[] = [];

    for (const job of selected) {
      const updatedJob: Job<unknown> = {
        ...job,
        status: 'processing',
        attempt: job.attempt + 1,
        lockedAt: now,
        lockedUntil: now + leaseTimeoutMs,
        lockedBy: workerId,
      };

      queueMap.set(job.id, updatedJob);
      claimed.push(updatedJob as Job<Payload>);
    }

    return claimed;
  }

  public async acknowledge(queueName: string, jobId: string): Promise<boolean> {
    const queueMap = this.queues.get(queueName);
    if (!queueMap) return false;

    const job = queueMap.get(jobId);
    if (!job) return false;

    // Remove job from active queue upon successful completion
    queueMap.delete(jobId);
    return true;
  }

  public async release(
    queueName: string,
    jobId: string,
    delayMs = 0,
    error?: JobErrorMetadata
  ): Promise<boolean> {
    const queueMap = this.queues.get(queueName);
    if (!queueMap) return false;

    const job = queueMap.get(jobId);
    if (!job) return false;

    const now = Date.now();
    const scheduledAt = delayMs > 0 ? now + delayMs : now;
    const status = delayMs > 0 ? 'scheduled' : 'pending';

    const updatedJob: Job<unknown> = {
      ...job,
      status,
      scheduledAt,
      lockedAt: undefined,
      lockedUntil: undefined,
      lockedBy: undefined,
      error,
    };

    queueMap.set(jobId, updatedJob);
    return true;
  }

  public async fail(queueName: string, jobId: string, error: JobErrorMetadata): Promise<boolean> {
    const queueMap = this.queues.get(queueName);
    if (!queueMap) return false;

    const job = queueMap.get(jobId);
    if (!job) return false;

    const updatedJob: Job<unknown> = {
      ...job,
      status: 'failed',
      lockedAt: undefined,
      lockedUntil: undefined,
      lockedBy: undefined,
      failedAt: Date.now(),
      error,
    };

    queueMap.set(jobId, updatedJob);
    return true;
  }

  public async cancel(queueName: string, jobId: string): Promise<boolean> {
    const queueMap = this.queues.get(queueName);
    if (!queueMap) return false;

    const job = queueMap.get(jobId);
    if (!job) return false;

    const updatedJob: Job<unknown> = {
      ...job,
      status: 'cancelled',
      lockedAt: undefined,
      lockedUntil: undefined,
      lockedBy: undefined,
    };

    queueMap.set(jobId, updatedJob);
    return true;
  }

  public async getJob<Payload = unknown>(
    queueName: string,
    jobId: string
  ): Promise<Job<Payload> | undefined> {
    const queueMap = this.queues.get(queueName);
    if (!queueMap) return undefined;
    return queueMap.get(jobId) as Job<Payload> | undefined;
  }

  public async clear(queueName: string): Promise<void> {
    const queueMap = this.queues.get(queueName);
    if (queueMap) {
      queueMap.clear();
    }
  }

  public async getQueueDepth(queueName: string): Promise<number> {
    const queueMap = this.queues.get(queueName);
    if (!queueMap) return 0;

    let count = 0;
    for (const job of queueMap.values()) {
      if (job.status === 'pending' || job.status === 'scheduled') {
        count++;
      }
    }
    return count;
  }

  public async getStats(queueName: string): Promise<QueueStats> {
    const queueMap = this.queues.get(queueName);
    let pendingCount = 0;
    let scheduledCount = 0;
    let processingCount = 0;
    let completedCount = 0;
    let failedCount = 0;

    if (queueMap) {
      for (const job of queueMap.values()) {
        switch (job.status) {
          case 'pending':
            pendingCount++;
            break;
          case 'scheduled':
            scheduledCount++;
            break;
          case 'processing':
            processingCount++;
            break;
          case 'completed':
            completedCount++;
            break;
          case 'failed':
            failedCount++;
            break;
        }
      }
    }

    return {
      queueName,
      pendingCount,
      scheduledCount,
      processingCount,
      completedCount,
      failedCount,
    };
  }

  public async close(): Promise<void> {
    this.queues.clear();
  }

  private getOrCreateQueue(queueName: string): Map<string, Job<unknown>> {
    let q = this.queues.get(queueName);
    if (!q) {
      q = new Map<string, Job<unknown>>();
      this.queues.set(queueName, q);
    }
    return q;
  }
}
