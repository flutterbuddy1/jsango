import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer as WSServer, WebSocket as WSWebSocket } from 'ws';
import type { ILogger } from '@django-js/core';
import { NoopLogger } from '@django-js/core';
import type {
  IWebSocketServer,
  WebSocketServerConfig,
  WebSocketStats,
  WebSocketIdentity,
} from '../public/types.js';
import { WebSocketManager } from '../public/manager.js';
import { WebSocketConnection } from '../public/connection.js';

export interface NodeWebSocketAdapterOptions extends WebSocketServerConfig {
  readonly server?: HttpServer;
  readonly port?: number;
  readonly host?: string;
}

/**
 * Production-ready Node.js WebSocket adapter wrapping the ws engine.
 * Isolates all ws library types behind the framework's IWebSocketServer / IWebSocketConnection abstractions.
 */
export class NodeWebSocketAdapter implements IWebSocketServer {
  public readonly manager: WebSocketManager;
  private readonly wss: WSServer;
  private readonly httpServer?: HttpServer | undefined;
  private readonly logger: ILogger;
  private readonly path: string;
  private readonly allowAnonymous: boolean;
  private isBoundToUpgrade = false;
  private _isListening = false;

  constructor(options: NodeWebSocketAdapterOptions = {}) {
    this.logger = options.logger ?? new NoopLogger();
    this.path = options.path ?? '/ws';
    this.allowAnonymous = options.allowAnonymous ?? false;
    this.httpServer = options.server;
    this.manager = new WebSocketManager(options);

    // If no external HTTP server is provided, we can run standalone with port/host if configured
    if (this.httpServer) {
      this.wss = new WSServer({ noServer: true });
    } else if (options.port !== undefined) {
      this.wss = new WSServer({
        port: options.port,
        host: options.host,
        path: this.path,
      });
      this._isListening = true;
    } else {
      this.wss = new WSServer({ noServer: true });
    }

    this.setupWssEvents();
  }

  public get isListening(): boolean {
    return this._isListening;
  }

  public get stats(): WebSocketStats {
    return this.manager.getStats();
  }

  /**
   * Starts the WebSocket server and binds HTTP upgrade listener if attached to an HTTP server.
   */
  public async start(): Promise<void> {
    if (this.httpServer && !this.isBoundToUpgrade) {
      this.httpServer.on('upgrade', this.handleUpgrade.bind(this));
      this.isBoundToUpgrade = true;
      this._isListening = true;
    }
    this.manager.heartbeat.start();
  }

  /**
   * HTTP upgrade handler when sharing an existing Node HTTP server.
   */
  public handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

    if (url.pathname !== this.path) {
      return; // Not our WebSocket endpoint, let other handlers handle it
    }

    // Execute authentication check
    void this.authenticateAndUpgrade(req, socket, head, url);
  }

  private async authenticateAndUpgrade(
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    url: URL
  ): Promise<void> {
    let identity: WebSocketIdentity | null = null;

    if (this.manager['authenticateHook']) {
      try {
        identity = await this.manager['authenticateHook']({
          url: req.url,
          headers: req.headers as Record<string, string | string[] | undefined>,
          queryParams: url.searchParams,
        });
      } catch (err) {
        this.logger.warn('WebSocket authentication failed during upgrade', {
          error: err instanceof Error ? err.message : String(err),
        });
        this.rejectUpgrade(socket, 401, 'Unauthorized');
        return;
      }
    }

    if (!identity && !this.allowAnonymous) {
      this.rejectUpgrade(socket, 401, 'Unauthorized');
      return;
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.handleConnectedSocket(ws, identity ?? undefined);
    });
  }

  private handleConnectedSocket(ws: WSWebSocket, identity?: WebSocketIdentity): void {
    const conn = new WebSocketConnection({
      socket: {
        readyState: ws.readyState,
        get bufferedAmount() {
          return ws.bufferedAmount;
        },
        send: (data, cb) => ws.send(data, cb),
        close: (code, reason) => ws.close(code, reason),
        terminate: () => ws.terminate(),
        ping: () => ws.ping(),
      },
      identity,
      maxBufferedAmountBytes: this.manager['limits'].maxBufferedAmountBytes,
    });

    try {
      this.manager.registerConnection(conn);
    } catch (err) {
      this.logger.warn('Failed to register incoming WebSocket connection', {
        error: err instanceof Error ? err.message : String(err),
      });
      ws.close(1008, 'Connection limit exceeded');
      return;
    }

    ws.on('message', (data: Buffer | string) => {
      void this.manager.processInboundMessage(conn, data).catch(() => {});
    });

    ws.on('pong', () => {
      this.manager.heartbeat.onPong(conn.id);
    });

    ws.on('close', () => {
      this.manager.unregisterConnection(conn.id);
    });

    ws.on('error', (err) => {
      this.logger.error('WebSocket client error', {
        connectionId: conn.id,
        error: err.message,
      });
    });
  }

  private setupWssEvents(): void {
    this.wss.on('connection', (ws: WSWebSocket) => {
      // Used only when WSS is handling standalone connections directly
      this.handleConnectedSocket(ws);
    });
  }

  private rejectUpgrade(socket: Duplex, statusCode: number, statusText: string): void {
    socket.write(
      `HTTP/1.1 ${statusCode} ${statusText}\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\n${statusText}`
    );
    socket.destroy();
  }

  public async close(timeoutMs = 5000): Promise<void> {
    this._isListening = false;
    await this.manager.close(timeoutMs);

    return new Promise((resolve) => {
      this.wss.close(() => {
        resolve();
      });
    });
  }
}
