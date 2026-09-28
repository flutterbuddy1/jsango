import type { Server as HttpServer } from 'node:http';
import { WebSocket as WSWebSocket } from 'ws';
import type { Identity } from '@jsango/auth';
export interface ISimpleWebSocket {
    readonly id: string;
    readonly user?: Identity | undefined;
    send(data: unknown): Promise<void>;
    broadcast(data: unknown): Promise<void>;
    join(room: string): void;
    leave(room: string): void;
    to(room: string): {
        send(data: unknown): Promise<void>;
    };
    on(event: 'message', handler: (data: unknown) => void | Promise<void>): this;
    on(event: 'close', handler: (code: number, reason: string) => void | Promise<void>): this;
    on(event: 'error', handler: (err: Error) => void | Promise<void>): this;
    on(event: string, handler: (...args: any[]) => void | Promise<void>): this;
    close(code?: number, reason?: string): void;
}
export interface WebSocketRouteHandlers {
    open?(socket: ISimpleWebSocket): void | Promise<void>;
    message?(socket: ISimpleWebSocket, data: unknown): void | Promise<void>;
    close?(socket: ISimpleWebSocket, code: number, reason: string): void | Promise<void>;
    error?(socket: ISimpleWebSocket, err: Error): void | Promise<void>;
}
export type WebSocketRouteCallback = ((socket: ISimpleWebSocket) => void | Promise<void>) | WebSocketRouteHandlers;
export declare class SimpleWebSocketConnection implements ISimpleWebSocket {
    readonly id: string;
    readonly user?: Identity | undefined;
    private readonly ws;
    private readonly hub;
    private readonly eventHandlers;
    constructor(id: string, ws: WSWebSocket, hub: WebSocketHub, user?: Identity);
    send(data: unknown): Promise<void>;
    broadcast(data: unknown): Promise<void>;
    join(room: string): void;
    leave(room: string): void;
    to(room: string): {
        send(data: unknown): Promise<void>;
    };
    on(event: string, handler: Function): this;
    emit(event: string, ...args: unknown[]): void;
    close(code?: number, reason?: string): void;
}
export declare class WebSocketHub {
    private readonly connections;
    private readonly rooms;
    addConnection(conn: SimpleWebSocketConnection): void;
    removeConnection(conn: SimpleWebSocketConnection): void;
    joinRoom(connId: string, room: string): void;
    leaveRoom(connId: string, room: string): void;
    broadcast(data: unknown, excludeConnId?: string): Promise<void>;
    sendToRoom(room: string, data: unknown): Promise<void>;
}
export declare class WebSocketEndpointManager {
    private readonly routes;
    private wss?;
    private isListening;
    register(path: string, callback: WebSocketRouteCallback): void;
    hasRoutes(): boolean;
    getRoutes(): string[];
    attach(server: HttpServer): void;
    close(): Promise<void>;
}
//# sourceMappingURL=websocket-wrapper.d.ts.map