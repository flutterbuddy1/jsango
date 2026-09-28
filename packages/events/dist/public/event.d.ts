import type { CreateEventOptions, EventDefinition } from './types.js';
/**
 * Creates an immutable EventDefinition with a unique ID and timestamp.
 */
export declare function createEvent<Payload = unknown>(options: CreateEventOptions<Payload>): EventDefinition<Payload>;
//# sourceMappingURL=event.d.ts.map