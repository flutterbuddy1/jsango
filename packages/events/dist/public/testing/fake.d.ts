import type { EventDefinition, DispatchOptions, CreateEventOptions } from '../types.js';
import { EventBus } from '../bus.js';
/**
 * FakeEventBus records all dispatched and emitted events for assertion in unit and integration tests.
 */
export declare class FakeEventBus extends EventBus {
    readonly dispatchedEvents: EventDefinition[];
    dispatch(event: EventDefinition, options?: DispatchOptions): Promise<void>;
    emit<Payload = unknown>(options: CreateEventOptions<Payload>, dispatchOptions?: DispatchOptions): Promise<EventDefinition<Payload>>;
    /**
     * Asserts whether an event of the given type was dispatched.
     */
    hasDispatched(eventType: string): boolean;
    /**
     * Returns all dispatched events matching the given type.
     */
    getDispatched<Payload = unknown>(eventType: string): EventDefinition<Payload>[];
    /**
     * Clears the recorded dispatched events.
     */
    reset(): void;
}
//# sourceMappingURL=fake.d.ts.map