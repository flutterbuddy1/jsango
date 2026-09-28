import { Queue } from '../queue.js';
import { MemoryQueueDriver } from '../drivers/memory.js';
/**
 * Developer-friendly FakeQueue for deterministic unit testing of job dispatching.
 */
export class FakeQueue extends Queue {
    dispatchedJobs = [];
    constructor(name = 'default') {
        const driver = new MemoryQueueDriver();
        super({ name, driver });
    }
    async dispatch(type, payload, options = {}) {
        const id = await super.dispatch(type, payload, options);
        const job = await this.getJob(id);
        if (job) {
            this.dispatchedJobs.push(job);
        }
        return id;
    }
    assertDispatched(type, filter) {
        const matching = this.dispatchedJobs.filter((j) => j.type === type);
        if (matching.length === 0) {
            throw new Error(`Expected job of type "${type}" to be dispatched, but none was found.`);
        }
        if (filter) {
            const matchWithFilter = matching.some((j) => filter(j.payload));
            if (!matchWithFilter) {
                throw new Error(`Job of type "${type}" was dispatched, but no instance matched the provided filter.`);
            }
        }
    }
    assertNotDispatched(type) {
        const matching = this.dispatchedJobs.filter((j) => j.type === type);
        if (matching.length > 0) {
            throw new Error(`Expected job of type "${type}" NOT to be dispatched, but found ${matching.length} instances.`);
        }
    }
    assertCount(expected) {
        if (this.dispatchedJobs.length !== expected) {
            throw new Error(`Expected ${expected} jobs to be dispatched, but got ${this.dispatchedJobs.length}.`);
        }
    }
    reset() {
        this.dispatchedJobs.length = 0;
    }
}
//# sourceMappingURL=fake.js.map