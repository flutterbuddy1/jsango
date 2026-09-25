import { randomUUID } from 'node:crypto';
import type {
  IWebSocketConnection,
  WebSocketIdentity,
  WebSocketOutboundMessage,
  WebSocketState,
} from './types.js';
import { WebSocketConnectionError, WebSocketLimitExceededError } from './errors.js';

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

export class WebSocketConnection implements IWebSocketConnection {
  public readonly id: string;
  public readonly connectedAt = Date.now();
  public isAlive = true;

  private readonly socket: UnderlyingSocket;
  private readonly maxBufferedAmountBytes?: number | undefined;
  private _identity?: WebSocketIdentity | undefined;
  private readonly _rooms = new Set<string>();
  private readonly _metadata = new Map<string, unknown>();
  private _state: WebSocketState = 'connected';

  constructor(options: WebSocketConnectionOptions) {
    this.id = options.id ?? randomUUID();
    this.socket = options.socket;
    this._identity = options.identity;
    this.maxBufferedAmountBytes = options.maxBufferedAmountBytes;
  }

  public get state(): WebSocketState {
    return this._state;
  }

  public get identity(): WebSocketIdentity | undefined {
    return this._identity;
  }

  public get rooms(): ReadonlySet<string> {
    return this._rooms;
  }

  public get metadata(): ReadonlyMap<string, unknown> {
    return this._metadata;
  }

  public get bufferedAmount(): number {
    return this.socket.bufferedAmount ?? 0;
  }

  public setIdentity(identity: WebSocketIdentity): void {
    this._identity = identity;
  }

  public setMetadata(key: string, value: unknown): void {
    this._metadata.set(key, value);
  }

  public addRoom(room: string): void {
    this._rooms.add(room);
  }

  public removeRoom(room: string): void {
    this._rooms.delete(room);
  }

  public markClosed(): void {
    this._state = 'closed';
  }

  public async send(message: WebSocketOutboundMessage): Promise<void> {
    if (this._state !== 'connected') {
      throw new WebSocketConnectionError({
        code: 'ERR_WS_NOT_CONNECTED',
        message: `Cannot send message to connection ${this.id}; connection state is ${this._state}.`,
      });
    }

    if (
      this.maxBufferedAmountBytes !== undefined &&
      this.bufferedAmount > this.maxBufferedAmountBytes
    ) {
      throw new WebSocketLimitExceededError({
        code: 'ERR_WS_BACKPRESSURE_LIMIT',
        message: `Connection ${this.id} exceeded buffered amount limit (${this.bufferedAmount} > ${this.maxBufferedAmountBytes} bytes).`,
      });
    }

    const data = JSON.stringify(message);

    return new Promise((resolve, reject) => {
      try {
        this.socket.send(data, (err) => {
          if (err) {
            reject(
              new WebSocketConnectionError({
                code: 'ERR_WS_SEND_FAILED',
                message: `Failed to send WebSocket message to connection ${this.id}: ${err.message}`,
                cause: err,
              })
            );
          } else {
            resolve();
          }
        });
      } catch (err) {
        reject(
          new WebSocketConnectionError({
            code: 'ERR_WS_SEND_FAILED',
            message: `Exception sending WebSocket message: ${err instanceof Error ? err.message : String(err)}`,
            cause: err,
          })
        );
      }
    });
  }

  public close(code?: number, reason?: string): void {
    this._state = 'closing';
    try {
      this.socket.close(code, reason);
    } catch {
      // Ignored if socket is already closing/closed
    }
  }

  public terminate(): void {
    this._state = 'closed';
    try {
      if (typeof this.socket.terminate === 'function') {
        this.socket.terminate();
      } else {
        this.socket.close(1006, 'Abnormal closure');
      }
    } catch {
      // Ignored
    }
  }

  public ping(): void {
    try {
      if (typeof this.socket.ping === 'function') {
        this.socket.ping();
      }
    } catch {
      // Ignored
    }
  }
}
