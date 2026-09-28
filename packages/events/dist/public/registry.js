import { EventRegistrationError } from './errors.js';
/**
 * Centralized registry managing event handler registrations.
 * Handlers are stored per event type, sorted by priority (higher first).
 */
export class EventRegistry {
    handlers = new Map();
    handlerCounter = 0;
    /**
     * Registers an event handler.
     */
    register(registration) {
        const id = registration.id ?? `handler-${++this.handlerCounter}`;
        // Check for duplicate handler IDs within this event type
        const existing = this.handlers.get(registration.type);
        if (existing?.some((h) => h.id === id)) {
            throw new EventRegistrationError({
                code: 'ERR_EVENT_DUPLICATE_HANDLER',
                message: `Handler "${id}" is already registered for event type "${registration.type}".`,
                metadata: { handlerId: id, eventType: registration.type },
            });
        }
        const entry = {
            id,
            type: registration.type,
            handler: registration.handler,
            mode: registration.mode,
            priority: registration.priority ?? 0,
            queue: registration.queue,
        };
        if (!this.handlers.has(registration.type)) {
            this.handlers.set(registration.type, []);
        }
        const list = this.handlers.get(registration.type);
        list.push(entry);
        // Sort by priority descending (higher priority first), then insertion order
        list.sort((a, b) => b.priority - a.priority);
        return id;
    }
    /**
     * Unregisters a handler by ID for a specific event type.
     */
    unregister(eventType, handlerId) {
        const list = this.handlers.get(eventType);
        if (!list)
            return false;
        const index = list.findIndex((h) => h.id === handlerId);
        if (index === -1)
            return false;
        list.splice(index, 1);
        if (list.length === 0) {
            this.handlers.delete(eventType);
        }
        return true;
    }
    /**
     * Checks if any handlers are registered for an event type.
     */
    hasHandlers(eventType) {
        return (this.handlers.get(eventType)?.length ?? 0) > 0;
    }
    /**
     * Retrieves all handlers for a given event type, sorted by priority.
     */
    getHandlers(eventType) {
        return this.handlers.get(eventType) ?? [];
    }
    /**
     * Retrieves handlers filtered by mode.
     */
    getHandlersByMode(eventType, mode) {
        return this.getHandlers(eventType).filter((h) => h.mode === mode);
    }
    /**
     * Returns all registered event types.
     */
    getEventTypes() {
        return [...this.handlers.keys()];
    }
    /**
     * Returns total handler count across all event types.
     */
    get size() {
        let count = 0;
        for (const list of this.handlers.values()) {
            count += list.length;
        }
        return count;
    }
    /**
     * Returns handler count for a specific event type.
     */
    handlerCount(eventType) {
        return this.handlers.get(eventType)?.length ?? 0;
    }
    /**
     * Returns introspection data for Admin compatibility.
     */
    inspect() {
        const result = [];
        for (const [type, list] of this.handlers) {
            result.push({
                type,
                handlerCount: list.length,
                handlers: list.map((h) => ({ id: h.id, mode: h.mode, priority: h.priority })),
            });
        }
        return result;
    }
    /**
     * Clears all registrations.
     */
    clear() {
        this.handlers.clear();
        this.handlerCounter = 0;
    }
}
//# sourceMappingURL=registry.js.map