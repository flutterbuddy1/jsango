import type { EventDefinition, DispatchOptions, CreateEventOptions } from '../types.js';
import { EventBus } from '../bus.js';

/**
 * FakeEventBus records all dispatched and emitted events for assertion in unit and integration tests.
 */
export class FakeEventBus extends EventBus {
  public readonly dispatchedEvents: EventDefinition[] = [];

  public override async dispatch(
    event: EventDefinition,
    options: DispatchOptions = {}
  ): Promise<void> {
    this.dispatchedEvents.push(event);
    return super.dispatch(event, options);
  }

  public override async emit<Payload = unknown>(
    options: CreateEventOptions<Payload>,
    dispatchOptions?: DispatchOptions
  ): Promise<EventDefinition<Payload>> {
    const event = await super.emit(options, dispatchOptions);
    return event;
  }

  /**
   * Asserts whether an event of the given type was dispatched.
   */
  public hasDispatched(eventType: string): boolean {
    return this.dispatchedEvents.some((e) => e.type === eventType);
  }

  /**
   * Returns all dispatched events matching the given type.
   */
  public getDispatched<Payload = unknown>(eventType: string): EventDefinition<Payload>[] {
    return this.dispatchedEvents.filter((e) => e.type === eventType) as EventDefinition<Payload>[];
  }

  /**
   * Clears the recorded dispatched events.
   */
  public reset(): void {
    this.dispatchedEvents.length = 0;
  }
}
