import { EventSerializer } from './serializer.js';
/**
 * Default queue adapter that dispatches events as job payloads.
 * Expects a dispatch function that enqueues a job — typically
 * wrapping QueueManager.dispatch() from @jsango/queue.
 *
 * This adapter prevents a hard compile-time dependency on @jsango/queue
 * while enabling full integration at runtime.
 */
export class QueueEventAdapter {
    dispatchFn;
    constructor(dispatchFn) {
        this.dispatchFn = dispatchFn;
    }
    async dispatch(event, queue) {
        const serialized = EventSerializer.serialize(event);
        const jobType = `event:${event.type}`;
        await this.dispatchFn(jobType, serialized, queue);
    }
}
//# sourceMappingURL=queue-adapter.js.map