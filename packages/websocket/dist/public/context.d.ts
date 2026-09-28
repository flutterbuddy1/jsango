import type { ILogger } from '@jsango/core';
import type { IWebSocketConnection, WebSocketIdentity, WebSocketInboundMessage, WebSocketOutboundMessage } from './types.js';
export interface WebSocketContextOptions {
    readonly connection: IWebSocketConnection;
    readonly message?: WebSocketInboundMessage | undefined;
    readonly logger?: ILogger | undefined;
    readonly signal?: AbortSignal | undefined;
}
/**
 * Encapsulates the execution context for an inbound WebSocket message.
 * Follows the same ergonomics and structure as HTTP RequestContext.
 */
export declare class WebSocketContext {
    readonly connection: IWebSocketConnection;
    readonly connectionId: string;
    readonly message?: WebSocketInboundMessage | undefined;
    readonly logger: ILogger;
    readonly signal?: AbortSignal | undefined;
    readonly state: Map<string, unknown>;
    constructor(options: WebSocketContextOptions);
    get identity(): WebSocketIdentity | undefined;
    /**
     * Sends an outbound message back to this connection.
     */
    send(message: WebSocketOutboundMessage): Promise<void>;
    /**
     * Sends a response matching the requestId of the inbound message.
     */
    reply(type: string, payload?: unknown): Promise<void>;
    /**
     * Closes the underlying WebSocket connection.
     */
    close(code?: number, reason?: string): void;
}
//# sourceMappingURL=context.d.ts.map