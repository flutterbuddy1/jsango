import type { EventDefinition, IEventQueueAdapter } from './types.js';
import { EventSerializer } from './serializer.js';

/**
 * Default queue adapter that dispatches events as job payloads.
 * Expects a dispatch function that enqueues a job — typically
 * wrapping QueueManager.dispatch() from @django-js/queue.
 *
 * This adapter prevents a hard compile-time dependency on @django-js/queue
 * while enabling full integration at runtime.
 */
export class QueueEventAdapter implements IEventQueueAdapter {
  private readonly dispatchFn: (jobType: string, payload: unknown, queue?: string) => Promise<void>;

  constructor(dispatchFn: (jobType: string, payload: unknown, queue?: string) => Promise<void>) {
    this.dispatchFn = dispatchFn;
  }

  public async dispatch(event: EventDefinition, queue?: string): Promise<void> {
    const serialized = EventSerializer.serialize(event);
    const jobType = `event:${event.type}`;
    await this.dispatchFn(jobType, serialized, queue);
  }
}
