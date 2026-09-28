import type { DispatchOptions, Job } from '../types.js';
import { Queue } from '../queue.js';
/**
 * Developer-friendly FakeQueue for deterministic unit testing of job dispatching.
 */
export declare class FakeQueue extends Queue {
    readonly dispatchedJobs: Job<unknown>[];
    constructor(name?: string);
    dispatch<Payload = unknown>(type: string, payload: Payload, options?: DispatchOptions): Promise<string>;
    assertDispatched(type: string, filter?: (payload: unknown) => boolean): void;
    assertNotDispatched(type: string): void;
    assertCount(expected: number): void;
    reset(): void;
}
//# sourceMappingURL=fake.d.ts.map