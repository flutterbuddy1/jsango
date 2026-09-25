import type { ILogger } from '@django-js/core';

/**
 * Metadata attached to every dispatched event.
 */
export interface EventMetadata {
  readonly [key: string]: unknown;
}

/**
 * Immutable event object dispatched through the EventBus.
 */
export interface EventDefinition<Payload = unknown> {
  readonly eventId: string;
  readonly type: string;
  readonly payload: Payload;
  readonly schemaVersion: number;
  readonly timestamp: number;
  readonly metadata?: EventMetadata | undefined;
}

/**
 * Handler execution mode.
 * - sync: executes sequentially in-process, blocks dispatch until complete.
 * - async: executes concurrently in-process via Promise.allSettled.
 * - queued: dispatches to @django-js/queue via adapter for background processing.
 */
export type EventHandlerMode = 'sync' | 'async' | 'queued';

/**
 * Event handler function signature.
 */
export type EventHandlerFn<Payload = unknown> = (
  event: EventDefinition<Payload>
) => void | Promise<void>;

/**
 * Registration entry for an event handler.
 */
export interface EventHandlerRegistration<Payload = unknown> {
  readonly type: string;
  readonly handler: EventHandlerFn<Payload>;
  readonly mode: EventHandlerMode;
  readonly priority?: number | undefined;
  readonly queue?: string | undefined;
  readonly id?: string | undefined;
}

export type EventMiddlewareNext = () => Promise<void>;

/**
 * Event middleware function signature.
 */
export type EventMiddlewareHandler = (
  event: EventDefinition,
  next: EventMiddlewareNext
) => Promise<void>;

export interface EventInspectionRecord {
  readonly type: string;
  readonly handlerCount: number;
  readonly handlers: ReadonlyArray<{
    readonly id: string;
    readonly mode: EventHandlerMode;
    readonly priority: number;
  }>;
}

/**
 * Lifecycle hooks for observability integration.
 */
export interface EventLifecycleHooks {
  onDispatched?(event: EventDefinition): void;
  onHandlerStarted?(event: EventDefinition, handlerId: string): void;
  onHandlerCompleted?(event: EventDefinition, handlerId: string, durationMs: number): void;
  onHandlerFailed?(event: EventDefinition, handlerId: string, error: unknown): void;
}

/**
 * Options for creating an event.
 */
export interface CreateEventOptions<Payload = unknown> {
  readonly type: string;
  readonly payload: Payload;
  readonly schemaVersion?: number | undefined;
  readonly metadata?: EventMetadata | undefined;
}

/**
 * Options for dispatching an event.
 */
export interface DispatchOptions {
  /** If true, errors from sync handlers will be collected and thrown as an aggregate. */
  readonly throwOnHandlerError?: boolean | undefined;
}

/**
 * Queue adapter interface for decoupling events from queue internals.
 */
export interface IEventQueueAdapter {
  dispatch(event: EventDefinition, queue?: string): Promise<void>;
}

/**
 * EventBus configuration.
 */
export interface EventBusConfig {
  readonly logger?: ILogger | undefined;
  readonly hooks?: EventLifecycleHooks | undefined;
  readonly queueAdapter?: IEventQueueAdapter | undefined;
}
