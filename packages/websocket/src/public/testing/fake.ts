import { randomUUID } from 'node:crypto';
import type {
  IWebSocketConnection,
  IWebSocketServer,
  WebSocketIdentity,
  WebSocketOutboundMessage,
  WebSocketState,
  WebSocketStats,
} from '../types.js';
import { WebSocketManager } from '../manager.js';

export class FakeWebSocketConnection implements IWebSocketConnection {
  public readonly id: string;
  public state: WebSocketState = 'connected';
  public identity?: WebSocketIdentity | undefined;
  public readonly rooms = new Set<string>();
  public readonly metadata = new Map<string, unknown>();
  public readonly sentMessages: WebSocketOutboundMessage[] = [];
  public readonly connectedAt = Date.now();
  public bufferedAmount = 0;
  public isAlive = true;
  public closedCode?: number | undefined;
  public closedReason?: string | undefined;

  constructor(options: { id?: string; identity?: WebSocketIdentity } = {}) {
    this.id = options.id ?? randomUUID();
    this.identity = options.identity;
  }

  public setIdentity(identity: WebSocketIdentity): void {
    this.identity = identity;
  }

  public setMetadata(key: string, value: unknown): void {
    this.metadata.set(key, value);
  }

  public addRoom(room: string): void {
    this.rooms.add(room);
  }

  public removeRoom(room: string): void {
    this.rooms.delete(room);
  }

  public async send(message: WebSocketOutboundMessage): Promise<void> {
    this.sentMessages.push(message);
  }

  public close(code?: number, reason?: string): void {
    this.state = 'closed';
    this.closedCode = code;
    this.closedReason = reason;
  }

  public terminate(): void {
    this.state = 'closed';
  }

  public ping(): void {
    // No-op in fake
  }

  public reset(): void {
    this.sentMessages.length = 0;
  }
}

export class FakeWebSocketServer implements IWebSocketServer {
  public readonly manager = new WebSocketManager({ allowAnonymous: true });
  public isListening = false;

  public async start(): Promise<void> {
    this.isListening = true;
  }

  public async close(): Promise<void> {
    this.isListening = false;
    await this.manager.close();
  }

  public get stats(): WebSocketStats {
    return this.manager.getStats();
  }
}
