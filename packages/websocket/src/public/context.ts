import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';
import type {
  IWebSocketConnection,
  WebSocketIdentity,
  WebSocketInboundMessage,
  WebSocketOutboundMessage,
} from './types.js';

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
export class WebSocketContext {
  public readonly connection: IWebSocketConnection;
  public readonly connectionId: string;
  public readonly message?: WebSocketInboundMessage | undefined;
  public readonly logger: ILogger;
  public readonly signal?: AbortSignal | undefined;
  public readonly state = new Map<string, unknown>();

  constructor(options: WebSocketContextOptions) {
    this.connection = options.connection;
    this.connectionId = options.connection.id;
    this.message = options.message;
    this.logger = options.logger ?? new NoopLogger();
    this.signal = options.signal;
  }

  public get identity(): WebSocketIdentity | undefined {
    return this.connection.identity;
  }

  /**
   * Sends an outbound message back to this connection.
   */
  public async send(message: WebSocketOutboundMessage): Promise<void> {
    await this.connection.send(message);
  }

  /**
   * Sends a response matching the requestId of the inbound message.
   */
  public async reply(type: string, payload?: unknown): Promise<void> {
    const outbound: WebSocketOutboundMessage = {
      type,
      payload,
      ...(this.message?.requestId !== undefined ? { requestId: this.message.requestId } : {}),
    };
    await this.connection.send(outbound);
  }

  /**
   * Closes the underlying WebSocket connection.
   */
  public close(code?: number, reason?: string): void {
    this.connection.close(code, reason);
  }
}
