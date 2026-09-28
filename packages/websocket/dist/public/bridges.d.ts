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
export declare class WebSocketEventBridge {
    private readonly manager;
    private readonly eventBus;
    constructor(manager: WebSocketManager, eventBus: EventBusLike);
    /**
     * Forwards an event type from EventBus to a specific WebSocket room whenever fired.
     */
    bridgeToRoom(eventType: string, roomName: string, messageTransform?: (event: EventDefinitionLike) => WebSocketOutboundMessage): string;
    /**
     * Forwards an event type from EventBus to all WebSocket connections.
     */
    bridgeToAll(eventType: string, messageTransform?: (event: EventDefinitionLike) => WebSocketOutboundMessage): string;
}
/**
 * Bridges inbound WebSocket messages to the EventBus.
 */
export declare class WebSocketToEventBridge {
    private readonly manager;
    private readonly eventBus;
    constructor(manager: WebSocketManager, eventBus: EventBusLike);
    /**
     * Forwards an inbound WebSocket message type to the EventBus.
     */
    bridge(messageType: string, eventTransform?: (ctx: WebSocketContext, message: WebSocketInboundMessage) => EventDefinitionLike): void;
}
//# sourceMappingURL=bridges.d.ts.map