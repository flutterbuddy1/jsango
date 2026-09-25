import type { FailedJob } from './types.js';

export interface ListFailedJobsOptions {
  readonly queue?: string | undefined;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export interface IFailedJobStore {
  record<Payload = unknown>(failedJob: FailedJob<Payload>): Promise<void>;
  get<Payload = unknown>(id: string): Promise<FailedJob<Payload> | undefined>;
  list<Payload = unknown>(options?: ListFailedJobsOptions): Promise<readonly FailedJob<Payload>[]>;
  delete(id: string): Promise<boolean>;
  clear(queue?: string): Promise<number>;
  count(queue?: string): Promise<number>;
}

/**
 * In-Memory Failed Job Store implementation.
 */
export class MemoryFailedJobStore implements IFailedJobStore {
  private readonly failedJobs = new Map<string, FailedJob<unknown>>();

  public async record<Payload = unknown>(failedJob: FailedJob<Payload>): Promise<void> {
    this.failedJobs.set(failedJob.id, failedJob as FailedJob<unknown>);
  }

  public async get<Payload = unknown>(id: string): Promise<FailedJob<Payload> | undefined> {
    return this.failedJobs.get(id) as FailedJob<Payload> | undefined;
  }

  public async list<Payload = unknown>(
    options: ListFailedJobsOptions = {}
  ): Promise<readonly FailedJob<Payload>[]> {
    let list = [...this.failedJobs.values()] as FailedJob<Payload>[];

    if (options.queue) {
      list = list.filter((j) => j.queue === options.queue);
    }

    // Sort newest first
    list.sort((a, b) => b.failedAt - a.failedAt);

    const offset = options.offset ?? 0;
    const limit = options.limit ?? 50;

    return Object.freeze(list.slice(offset, offset + limit));
  }

  public async delete(id: string): Promise<boolean> {
    return this.failedJobs.delete(id);
  }

  public async clear(queue?: string): Promise<number> {
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

  public async count(queue?: string): Promise<number> {
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
