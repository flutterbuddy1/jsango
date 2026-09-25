import { randomUUID } from 'node:crypto';
import type { CreateEventOptions, EventDefinition } from './types.js';

/**
 * Creates an immutable EventDefinition with a unique ID and timestamp.
 */
export function createEvent<Payload = unknown>(
  options: CreateEventOptions<Payload>
): EventDefinition<Payload> {
  return Object.freeze({
    eventId: randomUUID(),
    type: options.type,
    payload: options.payload,
    schemaVersion: options.schemaVersion ?? 1,
    timestamp: Date.now(),
    metadata: options.metadata,
  });
}
