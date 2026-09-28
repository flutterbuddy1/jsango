/**
 * Deterministic In-Memory Queue Driver supporting priority ordering,
 * scheduled/delayed execution, and visibility leases.
 */
export class MemoryQueueDriver {
    name = 'memory';
    capabilities = {
        supportsPriority: true,
        supportsDelayedJobs: true,
        supportsVisibilityLease: true,
        maxPayloadBytes: 10 * 1024 * 1024,
    };
    // queueName -> jobId -> Job
    queues = new Map();
    async enqueue(job) {
        const queueMap = this.getOrCreateQueue(job.queue);
        queueMap.set(job.id, job);
    }
    async claim(queueName, workerId, leaseTimeoutMs, count = 1) {
        const queueMap = this.getOrCreateQueue(queueName);
        const now = Date.now();
        const claimable = [];
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
        const claimed = [];
        for (const job of selected) {
            const updatedJob = {
                ...job,
                status: 'processing',
                attempt: job.attempt + 1,
                lockedAt: now,
                lockedUntil: now + leaseTimeoutMs,
                lockedBy: workerId,
            };
            queueMap.set(job.id, updatedJob);
            claimed.push(updatedJob);
        }
        return claimed;
    }
    async acknowledge(queueName, jobId) {
        const queueMap = this.queues.get(queueName);
        if (!queueMap)
            return false;
        const job = queueMap.get(jobId);
        if (!job)
            return false;
        // Remove job from active queue upon successful completion
        queueMap.delete(jobId);
        return true;
    }
    async release(queueName, jobId, delayMs = 0, error) {
        const queueMap = this.queues.get(queueName);
        if (!queueMap)
            return false;
        const job = queueMap.get(jobId);
        if (!job)
            return false;
        const now = Date.now();
        const scheduledAt = delayMs > 0 ? now + delayMs : now;
        const status = delayMs > 0 ? 'scheduled' : 'pending';
        const updatedJob = {
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
    async fail(queueName, jobId, error) {
        const queueMap = this.queues.get(queueName);
        if (!queueMap)
            return false;
        const job = queueMap.get(jobId);
        if (!job)
            return false;
        const updatedJob = {
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
    async cancel(queueName, jobId) {
        const queueMap = this.queues.get(queueName);
        if (!queueMap)
            return false;
        const job = queueMap.get(jobId);
        if (!job)
            return false;
        const updatedJob = {
            ...job,
            status: 'cancelled',
            lockedAt: undefined,
            lockedUntil: undefined,
            lockedBy: undefined,
        };
        queueMap.set(jobId, updatedJob);
        return true;
    }
    async getJob(queueName, jobId) {
        const queueMap = this.queues.get(queueName);
        if (!queueMap)
            return undefined;
        return queueMap.get(jobId);
    }
    async clear(queueName) {
        const queueMap = this.queues.get(queueName);
        if (queueMap) {
            queueMap.clear();
        }
    }
    async getQueueDepth(queueName) {
        const queueMap = this.queues.get(queueName);
        if (!queueMap)
            return 0;
        let count = 0;
        for (const job of queueMap.values()) {
            if (job.status === 'pending' || job.status === 'scheduled') {
                count++;
            }
        }
        return count;
    }
    async getStats(queueName) {
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
    async close() {
        this.queues.clear();
    }
    getOrCreateQueue(queueName) {
        let q = this.queues.get(queueName);
        if (!q) {
            q = new Map();
            this.queues.set(queueName, q);
        }
        return q;
    }
}
//# sourceMappingURL=memory.js.map