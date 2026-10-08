import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer as WSServer, WebSocket as WSWebSocket } from 'ws';
import type { Identity } from '@jsango/auth';

export interface ISimpleWebSocket {
  readonly id: string;
  readonly user?: Identity | undefined;
  send(data: unknown): Promise<void>;
  broadcast(data: unknown): Promise<void>;
  join(room: string): void;
  leave(room: string): void;
  to(room: string): { send(data: unknown): Promise<void> };
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

export type WebSocketRouteCallback =
  ((socket: ISimpleWebSocket) => void | Promise<void>) | WebSocketRouteHandlers;

export class SimpleWebSocketConnection implements ISimpleWebSocket {
  public readonly id: string;
  public readonly user?: Identity | undefined;
  private readonly ws: WSWebSocket;
  private readonly hub: WebSocketHub;
  private readonly eventHandlers = new Map<string, Set<Function>>();

  constructor(id: string, ws: WSWebSocket, hub: WebSocketHub, user?: Identity) {
    this.id = id;
    this.ws = ws;
    this.hub = hub;
    this.user = user;

    this.ws.on('message', (raw: Buffer | string) => {
      let data: unknown;
      try {
        data = JSON.parse(raw.toString());
      } catch {
        data = raw.toString();
      }

      const handlers = this.eventHandlers.get('message');
      if (handlers) {
        for (const handler of handlers) {
          try {
            void handler(data);
          } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      this.hub.removeConnection(this);
      const handlers = this.eventHandlers.get('close');
      if (handlers) {
        for (const handler of handlers) {
          try {
            void handler(code, reason.toString());
          } catch (err: unknown) {
            this.emit('error', err instanceof Error ? err : new Error(String(err)));
          }
        }
      }
    });

    this.ws.on('error', (err: Error) => {
      this.emit('error', err);
    });
  }

  public async send(data: unknown): Promise<void> {
    if (this.ws.readyState !== WSWebSocket.OPEN) {
      return;
    }
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    return new Promise((resolve, reject) => {
      this.ws.send(payload, (err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async broadcast(data: unknown): Promise<void> {
    await this.hub.broadcast(data, this.id);
  }

  public join(room: string): void {
    this.hub.joinRoom(this.id, room);
  }

  public leave(room: string): void {
    this.hub.leaveRoom(this.id, room);
  }

  public to(room: string): { send(data: unknown): Promise<void> } {
    return {
      send: async (data: unknown) => {
        await this.hub.sendToRoom(room, data);
      },
    };
  }

  public on(event: string, handler: Function): this {
    let handlers = this.eventHandlers.get(event);
    if (!handlers) {
      handlers = new Set();
      this.eventHandlers.set(event, handlers);
    }
    handlers.add(handler);
    return this;
  }

  public emit(event: string, ...args: unknown[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          void handler(...args);
        } catch {
          // ignore error inside error handler
        }
      }
    }
  }

  public close(code = 1000, reason = 'Normal closure'): void {
    this.ws.close(code, reason);
  }
}

export class WebSocketHub {
  private readonly connections = new Map<string, SimpleWebSocketConnection>();
  private readonly rooms = new Map<string, Set<string>>();

  public addConnection(conn: SimpleWebSocketConnection): void {
    this.connections.set(conn.id, conn);
  }

  public removeConnection(conn: SimpleWebSocketConnection): void {
    this.connections.delete(conn.id);
    for (const [room, members] of this.rooms.entries()) {
      members.delete(conn.id);
      if (members.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  public joinRoom(connId: string, room: string): void {
    let members = this.rooms.get(room);
    if (!members) {
      members = new Set();
      this.rooms.set(room, members);
    }
    members.add(connId);
  }

  public leaveRoom(connId: string, room: string): void {
    const members = this.rooms.get(room);
    if (members) {
      members.delete(connId);
      if (members.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  public async broadcast(data: unknown, excludeConnId?: string): Promise<void> {
    const promises: Promise<void>[] = [];
    for (const conn of this.connections.values()) {
      if (conn.id !== excludeConnId) {
        promises.push(conn.send(data).catch(() => {}));
      }
    }
    await Promise.allSettled(promises);
  }

  public async sendToRoom(room: string, data: unknown): Promise<void> {
    const members = this.rooms.get(room);
    if (!members) return;

    const promises: Promise<void>[] = [];
    for (const connId of members) {
      const conn = this.connections.get(connId);
      if (conn) {
        promises.push(conn.send(data).catch(() => {}));
      }
    }
    await Promise.allSettled(promises);
  }
}

export class WebSocketEndpointManager {
  private readonly routes = new Map<
    string,
    { callback: WebSocketRouteCallback; hub: WebSocketHub }
  >();
  private wss?: WSServer;
  private isListening = false;

  public register(path: string, callback: WebSocketRouteCallback): void {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    this.routes.set(normalizedPath, { callback, hub: new WebSocketHub() });
  }

  public hasRoutes(): boolean {
    return this.routes.size > 0;
  }

  public getRoutes(): string[] {
    return Array.from(this.routes.keys());
  }

  public attach(server: HttpServer): void {
    if (this.isListening) return;
    this.wss = new WSServer({ noServer: true });

    server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
      const route = this.routes.get(url.pathname);

      if (!route) {
        return; // Not registered on our ws routes
      }

      this.wss!.handleUpgrade(req, socket, head, (ws: WSWebSocket) => {
        const id = 'ws_' + Math.random().toString(36).slice(2, 9);
        const simpleConn = new SimpleWebSocketConnection(id, ws, route.hub);
        route.hub.addConnection(simpleConn);

        if (typeof route.callback === 'function') {
          void route.callback(simpleConn);
        } else if (typeof route.callback === 'object') {
          const handlers = route.callback;
          if (handlers.open) {
            void handlers.open(simpleConn);
          }
          if (handlers.message) {
            simpleConn.on('message', (msg: unknown) => handlers.message!(simpleConn, msg));
          }
          if (handlers.close) {
            simpleConn.on('close', (code: number, reason: string) =>
              handlers.close!(simpleConn, code, reason)
            );
          }
          if (handlers.error) {
            simpleConn.on('error', (err: Error) => handlers.error!(simpleConn, err));
          }
        }
      });
    });

    this.isListening = true;
  }

  public async close(): Promise<void> {
    if (this.wss) {
      await new Promise<void>((resolve) => {
        this.wss!.close(() => resolve());
      });
    }
  }
}
