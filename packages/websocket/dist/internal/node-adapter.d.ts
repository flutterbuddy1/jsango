import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import type { IWebSocketServer, WebSocketServerConfig, WebSocketStats } from '../public/types.js';
import { WebSocketManager } from '../public/manager.js';
export interface NodeWebSocketAdapterOptions extends WebSocketServerConfig {
    readonly server?: HttpServer;
    readonly port?: number;
    readonly host?: string;
}
/**
 * Production-ready Node.js WebSocket adapter wrapping the ws engine.
 * Isolates all ws library types behind the framework's IWebSocketServer / IWebSocketConnection abstractions.
 */
export declare class NodeWebSocketAdapter implements IWebSocketServer {
    readonly manager: WebSocketManager;
    private readonly wss;
    private readonly httpServer?;
    private readonly logger;
    private readonly path;
    private readonly allowAnonymous;
    private isBoundToUpgrade;
    private _isListening;
    constructor(options?: NodeWebSocketAdapterOptions);
    get isListening(): boolean;
    get stats(): WebSocketStats;
    /**
     * Starts the WebSocket server and binds HTTP upgrade listener if attached to an HTTP server.
     */
    start(): Promise<void>;
    /**
     * HTTP upgrade handler when sharing an existing Node HTTP server.
     */
    handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void;
    private authenticateAndUpgrade;
    private handleConnectedSocket;
    private setupWssEvents;
    private rejectUpgrade;
    close(timeoutMs?: number): Promise<void>;
}
//# sourceMappingURL=node-adapter.d.ts.map