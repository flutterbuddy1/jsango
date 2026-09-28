import type { ConnectionLimits, IRealtimeTransport, IWebSocketConnection, WebSocketAuthHandler, WebSocketHandler, WebSocketMiddlewareHandler, WebSocketOutboundMessage, WebSocketRoomAuthHandler, WebSocketServerConfig, WebSocketStats } from './types.js';
import { WebSocketConnection } from './connection.js';
import { RoomManager } from './room.js';
import { HeartbeatManager } from './heartbeat.js';
import { WebSocketMiddlewarePipeline } from './middleware.js';
export declare class WebSocketManager {
    readonly rooms: RoomManager;
    readonly transport: IRealtimeTransport;
    readonly heartbeat: HeartbeatManager;
    readonly middlewarePipeline: WebSocketMiddlewarePipeline;
    readonly limits: ConnectionLimits;
    readonly authenticateHook?: WebSocketAuthHandler | undefined;
    readonly authorizeRoomJoinHook?: WebSocketRoomAuthHandler | undefined;
    readonly allowAnonymous: boolean;
    private readonly connections;
    private readonly identityToConnections;
    private readonly handlers;
    private defaultHandler?;
    private readonly logger;
    private totalMessagesReceived;
    private totalMessagesSent;
    private totalErrors;
    constructor(config?: WebSocketServerConfig);
    /**
     * Registers a handler for a specific message type.
     */
    on<TPayload = unknown>(type: string, handler: WebSocketHandler<TPayload>): this;
    /**
     * Sets the fallback handler for unmapped message types.
     */
    setDefaultHandler(handler: WebSocketHandler): this;
    /**
     * Registers middleware for message interception.
     */
    use(...middleware: WebSocketMiddlewareHandler[]): this;
    /**
     * Returns current server metrics and counters.
     */
    getStats(): WebSocketStats;
    /**
     * Gets an active connection by ID.
     */
    getConnection(id: string): IWebSocketConnection | undefined;
    /**
     * Adds and initializes an authenticated connection.
     */
    registerConnection(connection: WebSocketConnection): void;
    /**
     * Cleans up state when a connection disconnects.
     */
    unregisterConnection(connectionId: string): void;
    /**
     * Handles room joining with optional authorization check.
     */
    joinRoom(connectionId: string, room: string): Promise<void>;
    /**
     * Removes a connection from a room.
     */
    leaveRoom(connectionId: string, room: string): void;
    /**
     * Processes an inbound raw or parsed message from a connection.
     */
    processInboundMessage(connection: WebSocketConnection, rawMessage: string | Buffer): Promise<void>;
    /**
     * Sends a message to a single connection.
     */
    send(connectionId: string, message: WebSocketOutboundMessage): Promise<void>;
    /**
     * Broadcasts a message to all members of a room.
     */
    broadcast(room: string, message: WebSocketOutboundMessage): Promise<void>;
    /**
     * Broadcasts a message to all members of a room except a specific connection ID.
     */
    broadcastExcluding(room: string, message: WebSocketOutboundMessage, excludeConnectionId: string): Promise<void>;
    /**
     * Broadcasts a message to all active connections on this server.
     */
    broadcastAll(message: WebSocketOutboundMessage): Promise<void>;
    /**
     * Closes all active connections and cleans up resources.
     */
    close(_timeoutMs?: number): Promise<void>;
}
//# sourceMappingURL=manager.d.ts.map