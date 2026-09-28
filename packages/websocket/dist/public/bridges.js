/**
 * Bridges events from the EventBus to WebSocket rooms/connections.
 */
export class WebSocketEventBridge {
    manager;
    eventBus;
    constructor(manager, eventBus) {
        this.manager = manager;
        this.eventBus = eventBus;
    }
    /**
     * Forwards an event type from EventBus to a specific WebSocket room whenever fired.
     */
    bridgeToRoom(eventType, roomName, messageTransform) {
        return this.eventBus.on(eventType, async (event) => {
            const message = messageTransform
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
    bridgeToAll(eventType, messageTransform) {
        return this.eventBus.on(eventType, async (event) => {
            const message = messageTransform
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
    manager;
    eventBus;
    constructor(manager, eventBus) {
        this.manager = manager;
        this.eventBus = eventBus;
    }
    /**
     * Forwards an inbound WebSocket message type to the EventBus.
     */
    bridge(messageType, eventTransform) {
        this.manager.on(messageType, async (ctx, message) => {
            const eventToDispatch = eventTransform
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
//# sourceMappingURL=bridges.js.map