import { randomUUID } from 'node:crypto';
/**
 * Creates an immutable EventDefinition with a unique ID and timestamp.
 */
export function createEvent(options) {
    return Object.freeze({
        eventId: randomUUID(),
        type: options.type,
        payload: options.payload,
        schemaVersion: options.schemaVersion ?? 1,
        timestamp: Date.now(),
        metadata: options.metadata,
    });
}
//# sourceMappingURL=event.js.map