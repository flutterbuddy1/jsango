import type { EventDefinition, EventHandlerFn, EventHandlerRegistration, EventMiddlewareHandler, EventBusConfig, IEventQueueAdapter, DispatchOptions, CreateEventOptions } from './types.js';
import { EventRegistry } from './registry.js';
/**
 * Production EventBus orchestrating typed event dispatch across
 * synchronous, asynchronous, and queue-backed handlers.
 *
 * Execution order per event:
 * 1. Event middleware pipeline executes (logging, validation, etc.)
 * 2. Sync handlers execute sequentially in priority order
 * 3. Async handlers execute concurrently via Promise.allSettled
 * 4. Queued handlers dispatch to the queue adapter for background processing
 */
export declare class EventBus {
    readonly registry: EventRegistry;
    private readonly logger;
    private readonly hooks;
    private queueAdapter?;
    private readonly middlewarePipeline;
    private closed;
    constructor(config?: EventBusConfig);
    /**
     * Registers an event handler.
     */
    on<Payload = unknown>(type: string, handler: EventHandlerFn<Payload>, options?: {
        readonly mode?: 'sync' | 'async' | 'queued';
        readonly priority?: number;
        readonly queue?: string;
        readonly id?: string;
    }): string;
    /**
     * Registers a handler from a full registration object.
     */
    register<Payload = unknown>(registration: EventHandlerRegistration<Payload>): string;
    /**
     * Unregisters a handler.
     */
    off(eventType: string, handlerId: string): boolean;
    /**
     * Adds event middleware.
     */
    use(...middleware: EventMiddlewareHandler[]): this;
    /**
     * Creates and dispatches an event.
     */
    emit<Payload = unknown>(options: CreateEventOptions<Payload>, dispatchOptions?: DispatchOptions): Promise<EventDefinition<Payload>>;
    /**
     * Dispatches a pre-constructed event through middleware and all registered handlers.
     */
    dispatch(event: EventDefinition, options?: DispatchOptions): Promise<void>;
    /**
     * Sets the queue adapter for queued handler support.
     */
    setQueueAdapter(adapter: IEventQueueAdapter): void;
    /**
     * Closes the event bus.
     */
    close(): void;
    private executeHandlers;
    private assertNotClosed;
}
//# sourceMappingURL=bus.d.ts.map