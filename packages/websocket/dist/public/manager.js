import { NoopLogger } from '@jsango/core';
import { WebSocketAuthorizationError, WebSocketLimitExceededError, WebSocketMessageError, } from './errors.js';
import { WebSocketContext } from './context.js';
import { RoomManager } from './room.js';
import { HeartbeatManager } from './heartbeat.js';
import { LocalTransport } from './transport.js';
import { WebSocketMiddlewarePipeline } from './middleware.js';
export class WebSocketManager {
    rooms = new RoomManager();
    transport;
    heartbeat;
    middlewarePipeline = new WebSocketMiddlewarePipeline();
    limits;
    authenticateHook;
    authorizeRoomJoinHook;
    allowAnonymous;
    connections = new Map();
    identityToConnections = new Map();
    handlers = new Map();
    defaultHandler;
    logger;
    totalMessagesReceived = 0;
    totalMessagesSent = 0;
    totalErrors = 0;
    constructor(config = {}) {
        this.logger = config.logger ?? new NoopLogger();
        this.limits = config.limits ?? {};
        this.allowAnonymous = config.allowAnonymous ?? false;
        this.authenticateHook = config.authenticate;
        this.authorizeRoomJoinHook = config.authorizeRoomJoin;
        this.transport = config.transport ?? new LocalTransport();
        this.heartbeat = new HeartbeatManager(config.heartbeat, this.logger);
    }
    /**
     * Registers a handler for a specific message type.
     */
    on(type, handler) {
        this.handlers.set(type, handler);
        return this;
    }
    /**
     * Sets the fallback handler for unmapped message types.
     */
    setDefaultHandler(handler) {
        this.defaultHandler = handler;
        return this;
    }
    /**
     * Registers middleware for message interception.
     */
    use(...middleware) {
        this.middlewarePipeline.use(...middleware);
        return this;
    }
    /**
     * Returns current server metrics and counters.
     */
    getStats() {
        return {
            activeConnections: this.connections.size,
            activeRooms: this.rooms.getRoomCount(),
            totalMessagesReceived: this.totalMessagesReceived,
            totalMessagesSent: this.totalMessagesSent,
            totalErrors: this.totalErrors,
        };
    }
    /**
     * Gets an active connection by ID.
     */
    getConnection(id) {
        return this.connections.get(id);
    }
    /**
     * Adds and initializes an authenticated connection.
     */
    registerConnection(connection) {
        // 1. Total connection limit check
        if (this.limits.maxTotalConnections !== undefined &&
            this.connections.size >= this.limits.maxTotalConnections) {
            this.totalErrors++;
            throw new WebSocketLimitExceededError({
                code: 'ERR_WS_MAX_CONNECTIONS',
                message: `Maximum total connections limit reached (${this.limits.maxTotalConnections}).`,
            });
        }
        // 2. Per-identity connection limit check
        if (connection.identity && this.limits.maxConnectionsPerIdentity !== undefined) {
            const userConns = this.identityToConnections.get(connection.identity.id);
            if (userConns && userConns.size >= this.limits.maxConnectionsPerIdentity) {
                this.totalErrors++;
                throw new WebSocketLimitExceededError({
                    code: 'ERR_WS_MAX_CONNECTIONS_PER_IDENTITY',
                    message: `User ${connection.identity.id} exceeded maximum connection limit (${this.limits.maxConnectionsPerIdentity}).`,
                });
            }
        }
        this.connections.set(connection.id, connection);
        this.heartbeat.register(connection);
        if (connection.identity) {
            let userConns = this.identityToConnections.get(connection.identity.id);
            if (!userConns) {
                userConns = new Set();
                this.identityToConnections.set(connection.identity.id, userConns);
            }
            userConns.add(connection.id);
        }
        this.logger.debug('WebSocket connection registered', {
            connectionId: connection.id,
            identity: connection.identity?.id,
        });
    }
    /**
     * Cleans up state when a connection disconnects.
     */
    unregisterConnection(connectionId) {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return;
        }
        conn.markClosed();
        this.heartbeat.unregister(connectionId);
        this.connections.delete(connectionId);
        if (conn.identity) {
            const userConns = this.identityToConnections.get(conn.identity.id);
            if (userConns) {
                userConns.delete(connectionId);
                if (userConns.size === 0) {
                    this.identityToConnections.delete(conn.identity.id);
                }
            }
        }
        this.rooms.leaveAll(connectionId);
        this.logger.debug('WebSocket connection unregistered', { connectionId });
    }
    /**
     * Handles room joining with optional authorization check.
     */
    async joinRoom(connectionId, room) {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return;
        }
        if (this.authorizeRoomJoinHook) {
            const allowed = await this.authorizeRoomJoinHook(conn, room);
            if (!allowed) {
                this.totalErrors++;
                throw new WebSocketAuthorizationError({
                    code: 'ERR_WS_ROOM_JOIN_DENIED',
                    message: `Connection ${connectionId} is not authorized to join room "${room}".`,
                });
            }
        }
        this.rooms.join(connectionId, room, this.limits.maxRoomsPerConnection);
        conn.addRoom(room);
    }
    /**
     * Removes a connection from a room.
     */
    leaveRoom(connectionId, room) {
        const conn = this.connections.get(connectionId);
        if (conn) {
            conn.removeRoom(room);
        }
        this.rooms.leave(connectionId, room);
    }
    /**
     * Processes an inbound raw or parsed message from a connection.
     */
    async processInboundMessage(connection, rawMessage) {
        this.totalMessagesReceived++;
        // Size limit check
        const byteLength = typeof rawMessage === 'string' ? Buffer.byteLength(rawMessage) : rawMessage.length;
        if (this.limits.maxMessageSizeBytes !== undefined &&
            byteLength > this.limits.maxMessageSizeBytes) {
            this.totalErrors++;
            throw new WebSocketLimitExceededError({
                code: 'ERR_WS_MESSAGE_TOO_LARGE',
                message: `Message size (${byteLength} bytes) exceeds limit (${this.limits.maxMessageSizeBytes} bytes).`,
            });
        }
        let parsed;
        try {
            parsed = JSON.parse(rawMessage.toString());
            if (!parsed || typeof parsed !== 'object' || typeof parsed.type !== 'string') {
                throw new Error('Message must be a JSON object with a "type" string property.');
            }
        }
        catch (err) {
            this.totalErrors++;
            throw new WebSocketMessageError({
                code: 'ERR_WS_INVALID_MESSAGE_FORMAT',
                message: `Invalid WebSocket message payload: ${err instanceof Error ? err.message : String(err)}`,
                cause: err,
            });
        }
        const ctx = new WebSocketContext({
            connection,
            message: parsed,
            logger: this.logger,
        });
        try {
            await this.middlewarePipeline.execute(ctx, parsed, async () => {
                const handler = this.handlers.get(parsed.type) ?? this.defaultHandler;
                if (handler) {
                    await handler(ctx, parsed);
                }
                else {
                    this.logger.debug('No handler registered for WebSocket message type', {
                        type: parsed.type,
                        connectionId: connection.id,
                    });
                }
            });
        }
        catch (err) {
            this.totalErrors++;
            this.logger.error('Error handling WebSocket message', {
                type: parsed.type,
                connectionId: connection.id,
                error: err instanceof Error ? err.message : String(err),
            });
            throw err;
        }
    }
    /**
     * Sends a message to a single connection.
     */
    async send(connectionId, message) {
        const conn = this.connections.get(connectionId);
        if (!conn) {
            return;
        }
        this.totalMessagesSent++;
        await conn.send(message);
    }
    /**
     * Broadcasts a message to all members of a room.
     */
    async broadcast(room, message) {
        const members = this.rooms.getMembers(room);
        const promises = [];
        for (const connId of members) {
            const conn = this.connections.get(connId);
            if (conn && conn.state === 'connected') {
                this.totalMessagesSent++;
                promises.push(conn.send(message).catch(() => { }));
            }
        }
        await Promise.allSettled(promises);
    }
    /**
     * Broadcasts a message to all members of a room except a specific connection ID.
     */
    async broadcastExcluding(room, message, excludeConnectionId) {
        const members = this.rooms.getMembers(room);
        const promises = [];
        for (const connId of members) {
            if (connId === excludeConnectionId) {
                continue;
            }
            const conn = this.connections.get(connId);
            if (conn && conn.state === 'connected') {
                this.totalMessagesSent++;
                promises.push(conn.send(message).catch(() => { }));
            }
        }
        await Promise.allSettled(promises);
    }
    /**
     * Broadcasts a message to all active connections on this server.
     */
    async broadcastAll(message) {
        const promises = [];
        for (const conn of this.connections.values()) {
            if (conn.state === 'connected') {
                this.totalMessagesSent++;
                promises.push(conn.send(message).catch(() => { }));
            }
        }
        await Promise.allSettled(promises);
    }
    /**
     * Closes all active connections and cleans up resources.
     */
    async close(_timeoutMs = 5000) {
        this.heartbeat.stop();
        await this.transport.close();
        for (const conn of this.connections.values()) {
            conn.close(1001, 'Server shutting down');
        }
        this.connections.clear();
        this.identityToConnections.clear();
    }
}
//# sourceMappingURL=manager.js.map