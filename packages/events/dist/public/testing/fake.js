import { EventBus } from '../bus.js';
/**
 * FakeEventBus records all dispatched and emitted events for assertion in unit and integration tests.
 */
export class FakeEventBus extends EventBus {
    dispatchedEvents = [];
    async dispatch(event, options = {}) {
        this.dispatchedEvents.push(event);
        return super.dispatch(event, options);
    }
    async emit(options, dispatchOptions) {
        const event = await super.emit(options, dispatchOptions);
        return event;
    }
    /**
     * Asserts whether an event of the given type was dispatched.
     */
    hasDispatched(eventType) {
        return this.dispatchedEvents.some((e) => e.type === eventType);
    }
    /**
     * Returns all dispatched events matching the given type.
     */
    getDispatched(eventType) {
        return this.dispatchedEvents.filter((e) => e.type === eventType);
    }
    /**
     * Clears the recorded dispatched events.
     */
    reset() {
        this.dispatchedEvents.length = 0;
    }
}
//# sourceMappingURL=fake.js.map