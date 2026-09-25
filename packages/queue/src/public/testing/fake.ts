import type { DispatchOptions, Job } from '../types.js';
import { Queue } from '../queue.js';
import { MemoryQueueDriver } from '../drivers/memory.js';

/**
 * Developer-friendly FakeQueue for deterministic unit testing of job dispatching.
 */
export class FakeQueue extends Queue {
  public readonly dispatchedJobs: Job<unknown>[] = [];

  constructor(name = 'default') {
    const driver = new MemoryQueueDriver();
    super({ name, driver });
  }

  public override async dispatch<Payload = unknown>(
    type: string,
    payload: Payload,
    options: DispatchOptions = {}
  ): Promise<string> {
    const id = await super.dispatch(type, payload, options);
    const job = await this.getJob<Payload>(id);
    if (job) {
      this.dispatchedJobs.push(job as Job<unknown>);
    }
    return id;
  }

  public assertDispatched(type: string, filter?: (payload: unknown) => boolean): void {
    const matching = this.dispatchedJobs.filter((j) => j.type === type);
    if (matching.length === 0) {
      throw new Error(`Expected job of type "${type}" to be dispatched, but none was found.`);
    }

    if (filter) {
      const matchWithFilter = matching.some((j) => filter(j.payload));
      if (!matchWithFilter) {
        throw new Error(
          `Job of type "${type}" was dispatched, but no instance matched the provided filter.`
        );
      }
    }
  }

  public assertNotDispatched(type: string): void {
    const matching = this.dispatchedJobs.filter((j) => j.type === type);
    if (matching.length > 0) {
      throw new Error(
        `Expected job of type "${type}" NOT to be dispatched, but found ${matching.length} instances.`
      );
    }
  }

  public assertCount(expected: number): void {
    if (this.dispatchedJobs.length !== expected) {
      throw new Error(
        `Expected ${expected} jobs to be dispatched, but got ${this.dispatchedJobs.length}.`
      );
    }
  }

  public reset(): void {
    this.dispatchedJobs.length = 0;
  }
}
