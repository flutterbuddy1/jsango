export {
  type EventDefinition,
  type EventHandlerFn,
  type EventHandlerMode,
  type EventHandlerRegistration,
  type EventMiddlewareHandler,
  type EventMiddlewareNext,
  type EventBusConfig,
  type EventLifecycleHooks,
  type IEventQueueAdapter,
  type DispatchOptions,
  type CreateEventOptions,
  type EventInspectionRecord,
  type EventMetadata,
} from './public/types.js';

export {
  EventError,
  EventRegistrationError,
  EventHandlerError,
  EventSerializationError,
  EventDispatchError,
} from './public/errors.js';

export { createEvent } from './public/event.js';
export { EventRegistry } from './public/registry.js';
export { EventMiddlewarePipeline } from './public/middleware.js';
export { EventBus } from './public/bus.js';
export { EventSerializer } from './public/serializer.js';
export { QueueEventAdapter } from './public/queue-adapter.js';
