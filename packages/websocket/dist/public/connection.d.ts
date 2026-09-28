import type { IWebSocketConnection, WebSocketIdentity, WebSocketOutboundMessage, WebSocketState } from './types.js';
export interface UnderlyingSocket {
    readonly readyState: number;
    readonly bufferedAmount?: number | undefined;
    send(data: string | Uint8Array, cb?: (err?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate?(): void;
    ping?(): void;
}
export interface WebSocketConnectionOptions {
    readonly id?: string | undefined;
    readonly socket: UnderlyingSocket;
    readonly identity?: WebSocketIdentity | undefined;
    readonly maxBufferedAmountBytes?: number | undefined;
}
export declare class WebSocketConnection implements IWebSocketConnection {
    readonly id: string;
    readonly connectedAt: number;
    isAlive: boolean;
    private readonly socket;
    private readonly maxBufferedAmountBytes?;
    private _identity?;
    private readonly _rooms;
    private readonly _metadata;
    private _state;
    constructor(options: WebSocketConnectionOptions);
    get state(): WebSocketState;
    get identity(): WebSocketIdentity | undefined;
    get rooms(): ReadonlySet<string>;
    get metadata(): ReadonlyMap<string, unknown>;
    get bufferedAmount(): number;
    setIdentity(identity: WebSocketIdentity): void;
    setMetadata(key: string, value: unknown): void;
    addRoom(room: string): void;
    removeRoom(room: string): void;
    markClosed(): void;
    send(message: WebSocketOutboundMessage): Promise<void>;
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(): void;
}
//# sourceMappingURL=connection.d.ts.map