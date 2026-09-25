import type { ILogger } from '@jsango/core';
import type { WebSocketContext } from './context.js';

export type WebSocketState = 'connecting' | 'connected' | 'closing' | 'closed';

/**
 * Common Identity interface to support authentication integration without
 * introducing a strict compile-time dependency on @jsango/auth.
 */
export interface WebSocketIdentity {
  readonly id: string;
  readonly type: string;
  readonly isAuthenticated: boolean;
  readonly roles?: readonly string[] | undefined;
  readonly permissions?: readonly string[] | undefined;
  readonly attributes?: Readonly<Record<string, unknown>> | undefined;
}

export interface WebSocketInboundMessage<TPayload = unknown> {
  readonly type: string;
  readonly payload?: TPayload | undefined;
  readonly requestId?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface WebSocketOutboundMessage<TPayload = unknown> {
  readonly type: string;
  readonly payload?: TPayload | undefined;
  readonly requestId?: string | undefined;
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

export interface IWebSocketConnection {
  readonly id: string;
  readonly state: WebSocketState;
  readonly identity?: WebSocketIdentity | undefined;
  readonly rooms: ReadonlySet<string>;
  readonly metadata: ReadonlyMap<string, unknown>;
  readonly connectedAt: number;
  readonly bufferedAmount: number;

  setIdentity(identity: WebSocketIdentity): void;
  setMetadata(key: string, value: unknown): void;
  addRoom(room: string): void;
  removeRoom(room: string): void;
  send(message: WebSocketOutboundMessage): Promise<void>;
  close(code?: number, reason?: string): void;
  terminate(): void;
  ping(): void;
}

export interface ConnectionLimits {
  readonly maxTotalConnections?: number | undefined;
  readonly maxConnectionsPerIdentity?: number | undefined;
  readonly maxRoomsPerConnection?: number | undefined;
  readonly maxMessageSizeBytes?: number | undefined;
  readonly maxBufferedAmountBytes?: number | undefined;
}

export interface HeartbeatConfig {
  readonly enabled?: boolean | undefined;
  readonly pingIntervalMs?: number | undefined;
  readonly pongTimeoutMs?: number | undefined;
}

export type WebSocketHandler<TPayload = unknown> = (
  ctx: WebSocketContext,
  message: WebSocketInboundMessage<TPayload>
) => Promise<void> | void;

export type WebSocketMiddlewareNext = () => Promise<void>;

export type WebSocketMiddlewareHandler = (
  ctx: WebSocketContext,
  message: WebSocketInboundMessage,
  next: WebSocketMiddlewareNext
) => Promise<void>;

export type WebSocketAuthHandler = (req: {
  readonly url?: string | undefined;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly queryParams?: URLSearchParams | undefined;
}) => Promise<WebSocketIdentity | null> | WebSocketIdentity | null;

export type WebSocketRoomAuthHandler = (
  connection: IWebSocketConnection,
  room: string
) => Promise<boolean> | boolean;

export interface IRealtimeTransport {
  publish(channel: string, message: WebSocketOutboundMessage): Promise<void>;
  subscribe(channel: string, handler: (message: WebSocketOutboundMessage) => void): () => void;
  unsubscribe(channel: string): void;
  close(): Promise<void>;
}

export interface WebSocketStats {
  readonly activeConnections: number;
  readonly activeRooms: number;
  readonly totalMessagesReceived: number;
  readonly totalMessagesSent: number;
  readonly totalErrors: number;
}

export interface WebSocketServerConfig {
  readonly path?: string | undefined;
  readonly logger?: ILogger | undefined;
  readonly limits?: ConnectionLimits | undefined;
  readonly heartbeat?: HeartbeatConfig | undefined;
  readonly transport?: IRealtimeTransport | undefined;
  readonly authenticate?: WebSocketAuthHandler | undefined;
  readonly authorizeRoomJoin?: WebSocketRoomAuthHandler | undefined;
  readonly allowAnonymous?: boolean | undefined;
}

export interface IWebSocketServer {
  readonly isListening: boolean;
  readonly stats: WebSocketStats;
  start(): Promise<void>;
  close(timeoutMs?: number): Promise<void>;
}
