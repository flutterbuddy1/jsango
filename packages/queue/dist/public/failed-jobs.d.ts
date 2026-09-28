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
export declare class MemoryFailedJobStore implements IFailedJobStore {
    private readonly failedJobs;
    record<Payload = unknown>(failedJob: FailedJob<Payload>): Promise<void>;
    get<Payload = unknown>(id: string): Promise<FailedJob<Payload> | undefined>;
    list<Payload = unknown>(options?: ListFailedJobsOptions): Promise<readonly FailedJob<Payload>[]>;
    delete(id: string): Promise<boolean>;
    clear(queue?: string): Promise<number>;
    count(queue?: string): Promise<number>;
}
//# sourceMappingURL=failed-jobs.d.ts.map