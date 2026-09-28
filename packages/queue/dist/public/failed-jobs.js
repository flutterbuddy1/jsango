/**
 * In-Memory Failed Job Store implementation.
 */
export class MemoryFailedJobStore {
    failedJobs = new Map();
    async record(failedJob) {
        this.failedJobs.set(failedJob.id, failedJob);
    }
    async get(id) {
        return this.failedJobs.get(id);
    }
    async list(options = {}) {
        let list = [...this.failedJobs.values()];
        if (options.queue) {
            list = list.filter((j) => j.queue === options.queue);
        }
        // Sort newest first
        list.sort((a, b) => b.failedAt - a.failedAt);
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 50;
        return Object.freeze(list.slice(offset, offset + limit));
    }
    async delete(id) {
        return this.failedJobs.delete(id);
    }
    async clear(queue) {
        if (!queue) {
            const count = this.failedJobs.size;
            this.failedJobs.clear();
            return count;
        }
        let deleted = 0;
        for (const [id, job] of this.failedJobs.entries()) {
            if (job.queue === queue) {
                this.failedJobs.delete(id);
                deleted++;
            }
        }
        return deleted;
    }
    async count(queue) {
        if (!queue) {
            return this.failedJobs.size;
        }
        let c = 0;
        for (const job of this.failedJobs.values()) {
            if (job.queue === queue) {
                c++;
            }
        }
        return c;
    }
}
//# sourceMappingURL=failed-jobs.js.map