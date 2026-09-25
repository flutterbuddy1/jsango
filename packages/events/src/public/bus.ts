import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';
import type {
  EventDefinition,
  EventHandlerFn,
  EventHandlerRegistration,
  EventMiddlewareHandler,
  EventBusConfig,
  EventLifecycleHooks,
  IEventQueueAdapter,
  DispatchOptions,
  CreateEventOptions,
} from './types.js';
import { EventDispatchError, EventHandlerError } from './errors.js';
import { EventRegistry } from './registry.js';
import { EventMiddlewarePipeline } from './middleware.js';
import { createEvent } from './event.js';

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
export class EventBus {
  public readonly registry: EventRegistry;
  private readonly logger: ILogger;
  private readonly hooks: EventLifecycleHooks;
  private queueAdapter?: IEventQueueAdapter | undefined;
  private readonly middlewarePipeline = new EventMiddlewarePipeline();
  private closed = false;

  constructor(config: EventBusConfig = {}) {
    this.logger = config.logger ?? new NoopLogger();
    this.hooks = config.hooks ?? {};
    this.queueAdapter = config.queueAdapter;
    this.registry = new EventRegistry();
  }

  /**
   * Registers an event handler.
   */
  public on<Payload = unknown>(
    type: string,
    handler: EventHandlerFn<Payload>,
    options: {
      readonly mode?: 'sync' | 'async' | 'queued';
      readonly priority?: number;
      readonly queue?: string;
      readonly id?: string;
    } = {}
  ): string {
    return this.registry.register<Payload>({
      type,
      handler,
      mode: options.mode ?? 'sync',
      priority: options.priority,
      queue: options.queue,
      id: options.id,
    });
  }

  /**
   * Registers a handler from a full registration object.
   */
  public register<Payload = unknown>(registration: EventHandlerRegistration<Payload>): string {
    return this.registry.register<Payload>(registration);
  }

  /**
   * Unregisters a handler.
   */
  public off(eventType: string, handlerId: string): boolean {
    return this.registry.unregister(eventType, handlerId);
  }

  /**
   * Adds event middleware.
   */
  public use(...middleware: EventMiddlewareHandler[]): this {
    this.middlewarePipeline.use(...middleware);
    return this;
  }

  /**
   * Creates and dispatches an event.
   */
  public async emit<Payload = unknown>(
    options: CreateEventOptions<Payload>,
    dispatchOptions?: DispatchOptions
  ): Promise<EventDefinition<Payload>> {
    const event = createEvent(options);
    await this.dispatch(event as EventDefinition, dispatchOptions);
    return event;
  }

  /**
   * Dispatches a pre-constructed event through middleware and all registered handlers.
   */
  public async dispatch(event: EventDefinition, options: DispatchOptions = {}): Promise<void> {
    this.assertNotClosed();

    this.hooks.onDispatched?.(event);

    // Execute through middleware pipeline, then handlers
    await this.middlewarePipeline.execute(event, async () => {
      await this.executeHandlers(event, options);
    });
  }

  /**
   * Sets the queue adapter for queued handler support.
   */
  public setQueueAdapter(adapter: IEventQueueAdapter): void {
    this.queueAdapter = adapter;
  }

  /**
   * Closes the event bus.
   */
  public close(): void {
    this.closed = true;
  }

  private async executeHandlers(event: EventDefinition, options: DispatchOptions): Promise<void> {
    const syncHandlers = this.registry.getHandlersByMode(event.type, 'sync');
    const asyncHandlers = this.registry.getHandlersByMode(event.type, 'async');
    const queuedHandlers = this.registry.getHandlersByMode(event.type, 'queued');

    const errors: unknown[] = [];

    // 1. Execute sync handlers sequentially in priority order
    for (const registration of syncHandlers) {
      const startTime = Date.now();
      this.hooks.onHandlerStarted?.(event, registration.id);

      try {
        await registration.handler(event);
        this.hooks.onHandlerCompleted?.(event, registration.id, Date.now() - startTime);
      } catch (err) {
        this.hooks.onHandlerFailed?.(event, registration.id, err);
        this.logger.error('Sync event handler failed', {
          eventType: event.type,
          eventId: event.eventId,
          handlerId: registration.id,
          error: err instanceof Error ? err.message : String(err),
        });

        if (options.throwOnHandlerError) {
          errors.push(err);
        }
      }
    }

    // 2. Execute async handlers concurrently
    if (asyncHandlers.length > 0) {
      const asyncPromises = asyncHandlers.map(async (registration) => {
        const startTime = Date.now();
        this.hooks.onHandlerStarted?.(event, registration.id);

        try {
          await registration.handler(event);
          this.hooks.onHandlerCompleted?.(event, registration.id, Date.now() - startTime);
        } catch (err) {
          this.hooks.onHandlerFailed?.(event, registration.id, err);
          this.logger.error('Async event handler failed', {
            eventType: event.type,
            eventId: event.eventId,
            handlerId: registration.id,
            error: err instanceof Error ? err.message : String(err),
          });

          if (options.throwOnHandlerError) {
            errors.push(err);
          }
        }
      });

      await Promise.allSettled(asyncPromises);
    }

    // 3. Dispatch queued handlers to the queue adapter
    for (const registration of queuedHandlers) {
      if (!this.queueAdapter) {
        this.logger.warn('Queued handler registered but no queue adapter configured', {
          eventType: event.type,
          handlerId: registration.id,
        });
        continue;
      }

      try {
        await this.queueAdapter.dispatch(event, registration.queue);
      } catch (err) {
        this.hooks.onHandlerFailed?.(event, registration.id, err);
        this.logger.error('Failed to dispatch queued event handler', {
          eventType: event.type,
          eventId: event.eventId,
          handlerId: registration.id,
          error: err instanceof Error ? err.message : String(err),
        });

        if (options.throwOnHandlerError) {
          errors.push(err);
        }
      }
    }

    // Throw aggregate error if configured
    if (options.throwOnHandlerError && errors.length > 0) {
      throw new EventDispatchError({
        code: 'ERR_EVENT_HANDLER_FAILURES',
        message: `${errors.length} event handler(s) failed for event "${event.type}".`,
        metadata: { eventType: event.type, failureCount: errors.length },
        errors,
      });
    }
  }

  private assertNotClosed(): void {
    if (this.closed) {
      throw new EventHandlerError({
        code: 'ERR_EVENT_BUS_CLOSED',
        message: 'EventBus has been closed.',
      });
    }
  }
}
