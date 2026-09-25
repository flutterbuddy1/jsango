import type { WebSocketManager } from './manager.js';
import type { WebSocketOutboundMessage, WebSocketInboundMessage } from './types.js';
import type { WebSocketContext } from './context.js';

export interface EventDefinitionLike {
  readonly type: string;
  readonly payload?: unknown;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface EventBusLike {
  on(type: string, handler: (event: EventDefinitionLike) => Promise<void> | void): string;
  dispatch(event: EventDefinitionLike): Promise<void>;
}

/**
 * Bridges events from the EventBus to WebSocket rooms/connections.
 */
export class WebSocketEventBridge {
  private readonly manager: WebSocketManager;
  private readonly eventBus: EventBusLike;

  constructor(manager: WebSocketManager, eventBus: EventBusLike) {
    this.manager = manager;
    this.eventBus = eventBus;
  }

  /**
   * Forwards an event type from EventBus to a specific WebSocket room whenever fired.
   */
  public bridgeToRoom(
    eventType: string,
    roomName: string,
    messageTransform?: (event: EventDefinitionLike) => WebSocketOutboundMessage
  ): string {
    return this.eventBus.on(eventType, async (event: EventDefinitionLike) => {
      const message: WebSocketOutboundMessage = messageTransform
        ? messageTransform(event)
        : {
            type: event.type,
            payload: event.payload,
            metadata: event.metadata,
          };

      await this.manager.broadcast(roomName, message);
    });
  }

  /**
   * Forwards an event type from EventBus to all WebSocket connections.
   */
  public bridgeToAll(
    eventType: string,
    messageTransform?: (event: EventDefinitionLike) => WebSocketOutboundMessage
  ): string {
    return this.eventBus.on(eventType, async (event: EventDefinitionLike) => {
      const message: WebSocketOutboundMessage = messageTransform
        ? messageTransform(event)
        : {
            type: event.type,
            payload: event.payload,
            metadata: event.metadata,
          };

      await this.manager.broadcastAll(message);
    });
  }
}

/**
 * Bridges inbound WebSocket messages to the EventBus.
 */
export class WebSocketToEventBridge {
  private readonly manager: WebSocketManager;
  private readonly eventBus: EventBusLike;

  constructor(manager: WebSocketManager, eventBus: EventBusLike) {
    this.manager = manager;
    this.eventBus = eventBus;
  }

  /**
   * Forwards an inbound WebSocket message type to the EventBus.
   */
  public bridge(
    messageType: string,
    eventTransform?: (
      ctx: WebSocketContext,
      message: WebSocketInboundMessage
    ) => EventDefinitionLike
  ): void {
    this.manager.on(messageType, async (ctx, message) => {
      const eventToDispatch: EventDefinitionLike = eventTransform
        ? eventTransform(ctx, message)
        : {
            type: message.type,
            payload: message.payload,
            metadata: {
              source: 'websocket',
              connectionId: ctx.connectionId,
              userId: ctx.identity?.id,
            },
          };

      await this.eventBus.dispatch(eventToDispatch);
    });
  }
}
