import { EventSerializationError } from './errors.js';
/**
 * Serializes events safely for queue dispatch and transport.
 * Rejects non-serializable values (functions, symbols, closures).
 */
export class EventSerializer {
    /**
     * Serializes an EventDefinition to a JSON string.
     */
    static serialize(event) {
        this.validatePayload(event.payload);
        try {
            return JSON.stringify({
                eventId: event.eventId,
                type: event.type,
                schemaVersion: event.schemaVersion,
                payload: event.payload,
                timestamp: event.timestamp,
                metadata: event.metadata,
            });
        }
        catch (err) {
            throw new EventSerializationError({
                code: 'ERR_EVENT_SERIALIZATION',
                message: `Failed to serialize event "${event.type}": ${err instanceof Error ? err.message : String(err)}`,
                cause: err,
            });
        }
    }
    /**
     * Deserializes a string or SerializedEvent back to an EventDefinition.
     */
    static deserialize(input) {
        let data;
        if (typeof input === 'string') {
            try {
                data = JSON.parse(input);
            }
            catch (err) {
                throw new EventSerializationError({
                    code: 'ERR_EVENT_DESERIALIZATION',
                    message: `Malformed JSON during event deserialization: ${err instanceof Error ? err.message : String(err)}`,
                    cause: err,
                });
            }
        }
        else {
            data = input;
        }
        if (!data ||
            typeof data !== 'object' ||
            typeof data.type !== 'string' ||
            typeof data.eventId !== 'string') {
            throw new EventSerializationError({
                code: 'ERR_EVENT_DESERIALIZATION',
                message: 'Invalid serialized event data: missing required fields.',
            });
        }
        return Object.freeze({
            eventId: data.eventId,
            type: data.type,
            schemaVersion: data.schemaVersion ?? 1,
            payload: data.payload,
            timestamp: data.timestamp ?? Date.now(),
            metadata: data.metadata,
        });
    }
    /**
     * Validates that a payload is JSON-serializable.
     */
    static validatePayload(payload) {
        if (payload === null || payload === undefined)
            return;
        const type = typeof payload;
        if (type === 'function') {
            throw new EventSerializationError({
                code: 'ERR_EVENT_UNSUPPORTED_PAYLOAD',
                message: 'Event payloads cannot contain functions.',
            });
        }
        if (type === 'symbol') {
            throw new EventSerializationError({
                code: 'ERR_EVENT_UNSUPPORTED_PAYLOAD',
                message: 'Event payloads cannot contain symbols.',
            });
        }
        if (type === 'object') {
            // Check for nested functions or symbols before JSON.stringify
            const checkNested = (val, seen = new WeakSet()) => {
                if (val === null || val === undefined)
                    return;
                if (typeof val === 'function' || typeof val === 'symbol') {
                    throw new EventSerializationError({
                        code: 'ERR_EVENT_UNSUPPORTED_PAYLOAD',
                        message: 'Event payloads cannot contain functions or symbols.',
                    });
                }
                if (typeof val === 'object') {
                    if (seen.has(val)) {
                        throw new EventSerializationError({
                            code: 'ERR_EVENT_UNSUPPORTED_PAYLOAD',
                            message: 'Event payload contains circular references.',
                        });
                    }
                    seen.add(val);
                    for (const key of Object.keys(val)) {
                        checkNested(val[key], seen);
                    }
                }
            };
            checkNested(payload);
            try {
                JSON.stringify(payload);
            }
            catch (err) {
                throw new EventSerializationError({
                    code: 'ERR_EVENT_UNSUPPORTED_PAYLOAD',
                    message: 'Event payload is not JSON-serializable.',
                    cause: err,
                });
            }
        }
    }
}
//# sourceMappingURL=serializer.js.map