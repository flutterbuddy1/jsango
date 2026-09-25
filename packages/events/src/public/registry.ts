import type { EventHandlerFn, EventHandlerMode, EventHandlerRegistration } from './types.js';
import { EventRegistrationError } from './errors.js';

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
export class EventRegistry {
  private readonly handlers = new Map<string, InternalRegistration[]>();
  private handlerCounter = 0;

  /**
   * Registers an event handler.
   */
  public register<Payload = unknown>(registration: EventHandlerRegistration<Payload>): string {
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

    const entry: InternalRegistration = {
      id,
      type: registration.type,
      handler: registration.handler as EventHandlerFn,
      mode: registration.mode,
      priority: registration.priority ?? 0,
      queue: registration.queue,
    };

    if (!this.handlers.has(registration.type)) {
      this.handlers.set(registration.type, []);
    }

    const list = this.handlers.get(registration.type)!;
    list.push(entry);

    // Sort by priority descending (higher priority first), then insertion order
    list.sort((a, b) => b.priority - a.priority);

    return id;
  }

  /**
   * Unregisters a handler by ID for a specific event type.
   */
  public unregister(eventType: string, handlerId: string): boolean {
    const list = this.handlers.get(eventType);
    if (!list) return false;

    const index = list.findIndex((h) => h.id === handlerId);
    if (index === -1) return false;

    list.splice(index, 1);
    if (list.length === 0) {
      this.handlers.delete(eventType);
    }
    return true;
  }

  /**
   * Checks if any handlers are registered for an event type.
   */
  public hasHandlers(eventType: string): boolean {
    return (this.handlers.get(eventType)?.length ?? 0) > 0;
  }

  /**
   * Retrieves all handlers for a given event type, sorted by priority.
   */
  public getHandlers(eventType: string): readonly InternalRegistration[] {
    return this.handlers.get(eventType) ?? [];
  }

  /**
   * Retrieves handlers filtered by mode.
   */
  public getHandlersByMode(
    eventType: string,
    mode: EventHandlerMode
  ): readonly InternalRegistration[] {
    return this.getHandlers(eventType).filter((h) => h.mode === mode);
  }

  /**
   * Returns all registered event types.
   */
  public getEventTypes(): readonly string[] {
    return [...this.handlers.keys()];
  }

  /**
   * Returns total handler count across all event types.
   */
  public get size(): number {
    let count = 0;
    for (const list of this.handlers.values()) {
      count += list.length;
    }
    return count;
  }

  /**
   * Returns handler count for a specific event type.
   */
  public handlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length ?? 0;
  }

  /**
   * Returns introspection data for Admin compatibility.
   */
  public inspect(): ReadonlyArray<{
    readonly type: string;
    readonly handlerCount: number;
    readonly handlers: ReadonlyArray<{
      readonly id: string;
      readonly mode: EventHandlerMode;
      readonly priority: number;
    }>;
  }> {
    const result: Array<{
      type: string;
      handlerCount: number;
      handlers: Array<{ id: string; mode: EventHandlerMode; priority: number }>;
    }> = [];

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
  public clear(): void {
    this.handlers.clear();
    this.handlerCounter = 0;
  }
}
