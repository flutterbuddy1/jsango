import { randomUUID } from 'node:crypto';
import { STATUS_CODES, type IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer as WSServer, WebSocket as WSWebSocket } from 'ws';
import { getIdentity, type Identity } from '@jsango/auth';
import type { ILogger } from '@jsango/core';
import {
  HttpResponse,
  formatHttpErrorResponse,
  type HttpRequest,
  type RequestContext,
} from '@jsango/http';
import { Router } from '@jsango/router';

/** A connected client. */
export interface ISimpleWebSocket {
  /** Random id of this connection. */
  readonly id: string;
  /** The signed-in user when the route uses auth middleware (`auth.required()`). */
  readonly user?: Identity | undefined;
  /** Route parameters: `socket.params.room` for `app.ws('/chat/:room', ...)`. */
  readonly params: Readonly<Record<string, string>>;
  /** The upgrade request (headers, query, cookies). */
  readonly request: HttpRequest;
  /** The upgrade request's context: `auth.identity(socket.ctx)` and route middleware state. */
  readonly ctx: RequestContext;
  /** Rooms this socket is in. */
  readonly rooms: ReadonlySet<string>;
  /** Sends data (objects are sent as JSON). */
  send(data: unknown): Promise<void>;
  /** Sends `{ event, data }`, which the client can dispatch by event name. */
  emit(event: string, data?: unknown): Promise<void>;
  /** Sends to every other socket connected to the same route. */
  broadcast(data: unknown): Promise<void>;
  join(room: string): void;
  leave(room: string): void;
  /** Sends to everyone in a room except this socket. */
  to(room: string): RoomSender;
  /**
   * `'message'` gets every message; `'close'`, `'error'`; any other name gets the `data` of client
   * messages shaped `{ "event": name, "data": ... }`.
   */
  on(event: 'message', handler: (data: unknown) => unknown): this;
  on(event: 'close', handler: (code: number, reason: string) => unknown): this;
  on(event: 'error', handler: (err: Error) => unknown): this;
  on(event: string, handler: (data: any) => unknown): this;
  close(code?: number, reason?: string): void;
}

export interface RoomSender {
  send(data: unknown): Promise<void>;
  emit(event: string, data?: unknown): Promise<void>;
}

export interface WebSocketRouteHandlers {
  open?(socket: ISimpleWebSocket): unknown;
  message?(socket: ISimpleWebSocket, data: unknown): unknown;
  close?(socket: ISimpleWebSocket, code: number, reason: string): unknown;
  error?(socket: ISimpleWebSocket, err: Error): unknown;
  /** Largest accepted message in bytes. Default 64 KB. */
  maxPayload?: number;
  /**
   * Browser origins allowed to connect, e.g. `['https://app.example.com']`, or `'*'`. Default:
   * the same host as the server. Clients that send no `Origin` (servers, mobile apps) are allowed.
   */
  origins?: readonly string[] | '*';
}

export type WebSocketRouteCallback =
  ((socket: ISimpleWebSocket) => unknown) | WebSocketRouteHandlers;

type Middleware = (ctx: RequestContext, next: () => Promise<HttpResponse>) => unknown;

interface WsRoute {
  readonly path: string;
  readonly middleware: readonly Middleware[];
  readonly handlers: WebSocketRouteHandlers;
  readonly wss: WSServer;
}

const RESERVED_EVENTS = new Set(['message', 'close', 'error']);
const HEARTBEAT_MS = 30_000;
// A client that can't keep up is dropped instead of buffering without limit.
const MAX_BUFFERED_BYTES = 4 * 1024 * 1024;

class Connection implements ISimpleWebSocket {
  public readonly id = randomUUID();
  public readonly rooms = new Set<string>();
  public readonly user: Identity | undefined;
  public alive = true;
  private readonly listeners = new Map<string, Set<(...args: any[]) => unknown>>();

  constructor(
    public readonly ws: WSWebSocket,
    public readonly route: WsRoute,
    public readonly ctx: RequestContext,
    public readonly params: Readonly<Record<string, string>>,
    private readonly hub: WebSocketEndpointManager
  ) {
    const identity = getIdentity(ctx);
    this.user = identity.isAuthenticated ? identity : undefined;
  }

  public get request(): HttpRequest {
    return this.ctx.request;
  }

  public send(data: unknown): Promise<void> {
    if (this.ws.readyState !== WSWebSocket.OPEN) return Promise.resolve();
    if (this.ws.bufferedAmount > MAX_BUFFERED_BYTES) {
      this.ws.close(1013, 'Client too slow');
      return Promise.resolve();
    }
    const payload = typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data);
    return new Promise((resolve) => this.ws.send(payload, () => resolve()));
  }

  public emit(event: string, data?: unknown): Promise<void> {
    return this.send({ event, data });
  }

  public broadcast(data: unknown): Promise<void> {
    return this.hub.sendTo(`route:${this.route.path}`, data, this.id);
  }

  public join(room: string): void {
    this.rooms.add(room);
    this.hub.join(this, room);
  }

  public leave(room: string): void {
    this.rooms.delete(room);
    this.hub.leave(this, room);
  }

  public to(room: string): RoomSender {
    return {
      send: (data) => this.hub.sendTo(room, data, this.id),
      emit: (event, data) => this.hub.sendTo(room, { event, data }, this.id),
    };
  }

  public on(event: string, handler: (...args: any[]) => unknown): this {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(handler);
    return this;
  }

  /** Runs listeners; a throwing or rejecting handler is reported, never crashes the process. */
  public fire(event: string, ...args: unknown[]): void {
    for (const handler of this.listeners.get(event) ?? []) {
      this.hub.safely(this, () => handler(...args), event === 'error');
    }
  }

  public close(code = 1000, reason = ''): void {
    this.ws.close(code, reason);
  }
}

/** WebSocket routes of an application (`app.ws`) and the rooms shared by all of them. */
export class WebSocketEndpointManager {
  private readonly router = new Router();
  private readonly routes: WsRoute[] = [];
  private readonly rooms = new Map<string, Set<Connection>>();
  private readonly connections = new Set<Connection>();
  private heartbeat: NodeJS.Timeout | undefined;
  private logger: ILogger | undefined;
  private isProduction = true;

  public register(
    path: string,
    middleware: readonly Middleware[],
    callback: WebSocketRouteCallback
  ): void {
    const normalized = path.startsWith('/') ? path : `/${path}`;
    const handlers: WebSocketRouteHandlers =
      typeof callback === 'function' ? { open: callback } : callback;
    const route: WsRoute = {
      path: normalized,
      middleware,
      handlers,
      wss: new WSServer({ noServer: true, maxPayload: handlers.maxPayload ?? 64 * 1024 }),
    };
    this.routes.push(route);
    this.router.get(normalized, (() => route) as never);
  }

  public hasRoutes(): boolean {
    return this.routes.length > 0;
  }

  public getRoutes(): string[] {
    return this.routes.map((r) => r.path);
  }

  /** Called for every HTTP upgrade request once the server listens. */
  public async handleUpgrade(
    ctx: RequestContext,
    req: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    options: { logger: ILogger; isProduction: boolean }
  ): Promise<void> {
    this.logger = options.logger;
    this.isProduction = options.isProduction;
    this.startHeartbeat();
    socket.on('error', () => socket.destroy());

    const match = this.router.match('GET', ctx.request.pathname);
    if (match.type !== 'MATCHED') return reject(socket, 404);
    const route = (match.route.handler as unknown as () => WsRoute)();

    // Cross-site WebSocket hijacking: a page on another site could use the user's cookies.
    const origin = ctx.request.headers.get('origin');
    if (origin && !originAllowed(origin, ctx.request.url.host, route.handlers.origins)) {
      return reject(socket, 403, {
        error: { code: 'ERR_WS_ORIGIN', message: 'Origin not allowed.' },
      });
    }

    // Route middleware (auth, rate limits) runs on the upgrade request, like on HTTP routes.
    const allowed = HttpResponse.text('', { status: 101 });
    let result: unknown;
    try {
      const run = async (i: number): Promise<HttpResponse> =>
        i === route.middleware.length
          ? allowed
          : ((await route.middleware[i]!(ctx, () => run(i + 1))) as HttpResponse);
      (ctx.request as { params: Readonly<Record<string, string>> }).params = match.params;
      result = await run(0);
    } catch (err) {
      const formatted = formatHttpErrorResponse(err, this.isProduction);
      return reject(socket, formatted.statusCode, formatted.body);
    }
    if (result !== allowed) {
      const res = result instanceof HttpResponse ? result : undefined;
      return reject(socket, res?.statusCode ?? 403, typeof res?.body === 'string' ? res.body : '');
    }

    route.wss.handleUpgrade(req, socket, head, (ws) => this.connect(ws, route, ctx, match.params));
  }

  private connect(
    ws: WSWebSocket,
    route: WsRoute,
    ctx: RequestContext,
    params: Readonly<Record<string, string>>
  ): void {
    const conn = new Connection(ws, route, ctx, params, this);
    this.connections.add(conn);
    conn.join(`route:${route.path}`);
    if (conn.user) conn.join(`user:${conn.user.id}`);

    const { handlers } = route;
    if (handlers.message) conn.on('message', (data) => handlers.message!(conn, data));
    if (handlers.close) conn.on('close', (code, reason) => handlers.close!(conn, code, reason));
    if (handlers.error) conn.on('error', (err) => handlers.error!(conn, err));

    ws.on('pong', () => (conn.alive = true));
    ws.on('error', (err) => conn.fire('error', err));
    ws.on('message', (raw: Buffer, isBinary: boolean) => {
      let data: unknown = raw;
      if (!isBinary) {
        const text = raw.toString();
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
      conn.fire('message', data);
      const event = (data as { event?: unknown } | null)?.event;
      if (typeof event === 'string' && !RESERVED_EVENTS.has(event)) {
        conn.fire(event, (data as { data?: unknown }).data);
      }
    });
    ws.on('close', (code, reason) => {
      this.connections.delete(conn);
      for (const room of conn.rooms) this.leave(conn, room);
      conn.fire('close', code, reason.toString());
    });

    if (handlers.open) this.safely(conn, () => handlers.open!(conn));
  }

  public join(conn: Connection, room: string): void {
    let members = this.rooms.get(room);
    if (!members) this.rooms.set(room, (members = new Set()));
    members.add(conn);
  }

  public leave(conn: Connection, room: string): void {
    const members = this.rooms.get(room);
    members?.delete(conn);
    if (members?.size === 0) this.rooms.delete(room);
  }

  /** Sends to every socket in a room (optionally except one). */
  public async sendTo(room: string, data: unknown, exceptId?: string): Promise<void> {
    const members = [...(this.rooms.get(room) ?? [])].filter((c) => c.id !== exceptId);
    await Promise.all(members.map((c) => c.send(data)));
  }

  /** Runs user code; errors are logged and passed to the socket's error handlers. */
  public safely(conn: Connection, fn: () => unknown, isErrorHandler = false): void {
    Promise.resolve()
      .then(fn)
      .catch((err: unknown) => {
        const error = err instanceof Error ? err : new Error(String(err));
        this.logger?.error('WebSocket handler error', {
          route: conn.route.path,
          error: error.message,
          stack: error.stack,
        });
        if (!isErrorHandler) conn.fire('error', error);
      });
  }

  private startHeartbeat(): void {
    if (this.heartbeat) return;
    // Drops connections that stopped answering pings (closed laptops, dead networks).
    this.heartbeat = setInterval(() => {
      for (const conn of this.connections) {
        if (!conn.alive) {
          conn.ws.terminate();
          continue;
        }
        conn.alive = false;
        conn.ws.ping();
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref();
  }

  public async close(): Promise<void> {
    clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    for (const conn of this.connections) conn.close(1001, 'Server shutting down');
    await Promise.all(
      this.routes.map((r) => new Promise<void>((done) => r.wss.close(() => done())))
    );
  }
}

function originAllowed(origin: string, host: string, allowed: WebSocketRouteHandlers['origins']) {
  if (allowed === '*') return true;
  if (allowed) return allowed.includes(origin);
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function reject(socket: Duplex, status: number, body: unknown = ''): void {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  socket.end(
    `HTTP/1.1 ${status} ${STATUS_CODES[status] ?? ''}\r\n` +
      `Connection: close\r\nContent-Type: ${typeof body === 'string' ? 'text/plain' : 'application/json'}\r\n` +
      `Content-Length: ${Buffer.byteLength(text)}\r\n\r\n${text}`
  );
}
