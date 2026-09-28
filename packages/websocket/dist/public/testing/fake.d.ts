import type { IWebSocketConnection, IWebSocketServer, WebSocketIdentity, WebSocketOutboundMessage, WebSocketState, WebSocketStats } from '../types.js';
import { WebSocketManager } from '../manager.js';
export declare class FakeWebSocketConnection implements IWebSocketConnection {
    readonly id: string;
    state: WebSocketState;
    identity?: WebSocketIdentity | undefined;
    readonly rooms: Set<string>;
    readonly metadata: Map<string, unknown>;
    readonly sentMessages: WebSocketOutboundMessage[];
    readonly connectedAt: number;
    bufferedAmount: number;
    isAlive: boolean;
    closedCode?: number | undefined;
    closedReason?: string | undefined;
    constructor(options?: {
        id?: string;
        identity?: WebSocketIdentity;
    });
    setIdentity(identity: WebSocketIdentity): void;
    setMetadata(key: string, value: unknown): void;
    addRoom(room: string): void;
    removeRoom(room: string): void;
    send(message: WebSocketOutboundMessage): Promise<void>;
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(): void;
    reset(): void;
}
export declare class FakeWebSocketServer implements IWebSocketServer {
    readonly manager: WebSocketManager;
    isListening: boolean;
    start(): Promise<void>;
    close(): Promise<void>;
    get stats(): WebSocketStats;
}
//# sourceMappingURL=fake.d.ts.map