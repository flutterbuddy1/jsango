import type { EventHandlerFn, EventHandlerMode, EventHandlerRegistration } from './types.js';
interface InternalRegistration {
    readonly id: string;
    readonly type: string;
    readonly handler: EventHandlerFn;
    readonly mode: EventHandlerMode;
    readonly priority: number;
    readonly queue?: string | undefined;
}
/**
 * Centralized registry managing event handler registrations.
 * Handlers are stored per event type, sorted by priority (higher first).
 */
export declare class EventRegistry {
    private readonly handlers;
    private handlerCounter;
    /**
     * Registers an event handler.
     */
    register<Payload = unknown>(registration: EventHandlerRegistration<Payload>): string;
    /**
     * Unregisters a handler by ID for a specific event type.
     */
    unregister(eventType: string, handlerId: string): boolean;
    /**
     * Checks if any handlers are registered for an event type.
     */
    hasHandlers(eventType: string): boolean;
    /**
     * Retrieves all handlers for a given event type, sorted by priority.
     */
    getHandlers(eventType: string): readonly InternalRegistration[];
    /**
     * Retrieves handlers filtered by mode.
     */
    getHandlersByMode(eventType: string, mode: EventHandlerMode): readonly InternalRegistration[];
    /**
     * Returns all registered event types.
     */
    getEventTypes(): readonly string[];
    /**
     * Returns total handler count across all event types.
     */
    get size(): number;
    /**
     * Returns handler count for a specific event type.
     */
    handlerCount(eventType: string): number;
    /**
     * Returns introspection data for Admin compatibility.
     */
    inspect(): ReadonlyArray<{
        readonly type: string;
        readonly handlerCount: number;
        readonly handlers: ReadonlyArray<{
            readonly id: string;
            readonly mode: EventHandlerMode;
            readonly priority: number;
        }>;
    }>;
    /**
     * Clears all registrations.
     */
    clear(): void;
}
export {};
//# sourceMappingURL=registry.d.ts.map