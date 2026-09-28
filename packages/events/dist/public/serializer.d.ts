import type { EventDefinition } from './types.js';
/**
 * Serialized event format safe for queue/transport payloads.
 */
export interface SerializedEvent {
    readonly eventId: string;
    readonly type: string;
    readonly schemaVersion: number;
    readonly payload: unknown;
    readonly timestamp: number;
    readonly metadata?: Record<string, unknown> | undefined;
}
/**
 * Serializes events safely for queue dispatch and transport.
 * Rejects non-serializable values (functions, symbols, closures).
 */
export declare class EventSerializer {
    /**
     * Serializes an EventDefinition to a JSON string.
     */
    static serialize(event: EventDefinition): string;
    /**
     * Deserializes a string or SerializedEvent back to an EventDefinition.
     */
    static deserialize<Payload = unknown>(input: string | SerializedEvent): EventDefinition<Payload>;
    /**
     * Validates that a payload is JSON-serializable.
     */
    private static validatePayload;
}
//# sourceMappingURL=serializer.d.ts.map