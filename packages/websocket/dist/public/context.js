import { NoopLogger } from '@jsango/core';
/**
 * Encapsulates the execution context for an inbound WebSocket message.
 * Follows the same ergonomics and structure as HTTP RequestContext.
 */
export class WebSocketContext {
    connection;
    connectionId;
    message;
    logger;
    signal;
    state = new Map();
    constructor(options) {
        this.connection = options.connection;
        this.connectionId = options.connection.id;
        this.message = options.message;
        this.logger = options.logger ?? new NoopLogger();
        this.signal = options.signal;
    }
    get identity() {
        return this.connection.identity;
    }
    /**
     * Sends an outbound message back to this connection.
     */
    async send(message) {
        await this.connection.send(message);
    }
    /**
     * Sends a response matching the requestId of the inbound message.
     */
    async reply(type, payload) {
        const outbound = {
            type,
            payload,
            ...(this.message?.requestId !== undefined ? { requestId: this.message.requestId } : {}),
        };
        await this.connection.send(outbound);
    }
    /**
     * Closes the underlying WebSocket connection.
     */
    close(code, reason) {
        this.connection.close(code, reason);
    }
}
//# sourceMappingURL=context.js.map