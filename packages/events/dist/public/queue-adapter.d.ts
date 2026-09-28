import type { EventDefinition, IEventQueueAdapter } from './types.js';
/**
 * Default queue adapter that dispatches events as job payloads.
 * Expects a dispatch function that enqueues a job — typically
 * wrapping QueueManager.dispatch() from @jsango/queue.
 *
 * This adapter prevents a hard compile-time dependency on @jsango/queue
 * while enabling full integration at runtime.
 */
export declare class QueueEventAdapter implements IEventQueueAdapter {
    private readonly dispatchFn;
    constructor(dispatchFn: (jobType: string, payload: unknown, queue?: string) => Promise<void>);
    dispatch(event: EventDefinition, queue?: string): Promise<void>;
}
//# sourceMappingURL=queue-adapter.d.ts.map