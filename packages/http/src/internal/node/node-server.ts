import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { once } from 'node:events';
import type { Duplex } from 'node:stream';
import type { AddressInfo } from 'node:net';
import type { IHttpServer, HttpServerHandler, ServerAddress } from '../../public/server.js';
import { HttpRequest } from '../../public/request.js';
import { HttpResponse } from '../../public/response.js';
import { RequestContext } from '../../public/context.js';
import { formatHttpErrorResponse } from '../../public/errors.js';
import { type HttpMethod } from '../../public/methods.js';
import type { ILogger } from '@jsango/core';
import { NoopLogger } from '@jsango/core';

export interface NodeHttpServerOptions {
  readonly logger?: ILogger | undefined;
  readonly isProduction?: boolean | undefined;
  readonly maxBodySize?: number | undefined;
  /**
   * Behind a reverse proxy / load balancer: `true` (one proxy) or the number of proxies. Client
   * IP, protocol and host then come from `X-Forwarded-For` / `-Proto` / `-Host`. Default: false
   * (those headers are ignored, since clients can forge them).
   */
  readonly trustProxy?: boolean | number | undefined;
  /** Keep-alive idle timeout. Default 65s: longer than common load balancer timeouts (60s). */
  readonly keepAliveTimeoutMs?: number | undefined;
  /**
   * Handles HTTP upgrade requests (WebSockets). `ctx` is built like for normal requests (validated
   * host, `trustProxy`). Without it, upgrade requests are refused.
   */
  readonly onUpgrade?:
    | ((ctx: RequestContext, req: IncomingMessage, socket: Duplex, head: Buffer) => unknown)
    | undefined;
}

const VALID_HOST = /^(?:[a-z0-9_.-]+|\[[0-9a-f:.]+\])(?::\d{1,5})?$/i;

export class NodeHttpServer implements IHttpServer {
  private readonly handler: HttpServerHandler;
  private readonly options: NodeHttpServerOptions;
  private readonly logger: ILogger;
  private server: Server | null = null;
  private activeRequests = 0;
  private readonly activeControllers = new Set<AbortController>();

  constructor(handler: HttpServerHandler, options: NodeHttpServerOptions = {}) {
    this.handler = handler;
    this.options = options;
    this.logger = options.logger ?? new NoopLogger();
  }

  public get isListening(): boolean {
    return this.server !== null && this.server.listening;
  }

  public getUnderlyingServer(): Server | null {
    return this.server;
  }

  public get address(): ServerAddress | null {
    if (!this.server) return null;
    const addr = this.server.address();
    if (!addr || typeof addr === 'string') return null;
    const info = addr as AddressInfo;
    return {
      port: info.port,
      host: info.address,
      family: info.family,
    };
  }

  public async listen(port = 3000, host = '127.0.0.1'): Promise<ServerAddress> {
    if (this.server) {
      throw new Error('Server is already running.');
    }

    return new Promise<ServerAddress>((resolve, reject) => {
      const srv = createServer((req, res) => {
        this.handleNodeRequest(req, res).catch((err: unknown) => {
          this.logger.error('Unhandled request processing error', {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      });

      srv.keepAliveTimeout = this.options.keepAliveTimeoutMs ?? 65_000;
      srv.headersTimeout = srv.keepAliveTimeout + 1_000;

      srv.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
        const onUpgrade = this.options.onUpgrade;
        if (!onUpgrade) {
          socket.destroy();
          return;
        }
        const controller = new AbortController();
        socket.once('close', () => controller.abort());
        Promise.resolve()
          .then(() => {
            const ctx = new RequestContext({
              request: this.translateRequest(req, controller.signal),
              logger: this.logger,
              signal: controller.signal,
            });
            return onUpgrade(ctx, req, socket, head);
          })
          .catch((err: unknown) => {
            this.logger.error('Upgrade request failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            socket.destroy();
          });
      });

      srv.on('error', (err: Error) => {
        reject(err);
      });

      srv.listen(port, host, () => {
        this.server = srv;
        const addr = this.address;
        if (addr) {
          resolve(addr);
        } else {
          resolve({ port, host, family: 'IPv4' });
        }
      });
    });
  }

  public async close(timeoutMs = 5000): Promise<void> {
    if (!this.server) return;

    const srv = this.server;
    this.server = null;

    return new Promise<void>((resolve, reject) => {
      // Set timeout for in-flight requests
      const timer = setTimeout(() => {
        for (const controller of this.activeControllers) {
          controller.abort();
        }
        srv.closeAllConnections?.();
        resolve();
      }, timeoutMs);

      srv.close((err?: Error) => {
        clearTimeout(timer);
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  private async handleNodeRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.activeRequests++;
    const abortController = new AbortController();
    this.activeControllers.add(abortController);

    // The client went away before the response finished. (Not `req` 'close': since Node 16 that
    // fires as soon as the request body is read, which aborted every POST mid-handler.)
    res.on('close', () => {
      if (!res.writableFinished) abortController.abort();
    });

    try {
      const httpRequest = this.translateRequest(req, abortController.signal);
      const ctx = new RequestContext({
        request: httpRequest,
        logger: this.logger,
        signal: abortController.signal,
      });

      let response: HttpResponse;
      try {
        response = await this.handler(ctx);
      } catch (handlerError) {
        const isProd = this.options.isProduction ?? true;
        const formatted = formatHttpErrorResponse(handlerError, isProd);
        response = HttpResponse.json(formatted.body, { status: formatted.statusCode });
      }

      await this.sendResponse(response, res);
    } catch (err) {
      // Never leave a request hanging: answer 400 if nothing was sent, else cut the connection.
      this.logger.error('Request failed', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      if (!res.headersSent) {
        res.statusCode = 400;
        res.end();
      } else {
        res.destroy(err instanceof Error ? err : undefined);
      }
    } finally {
      this.activeControllers.delete(abortController);
      this.activeRequests--;
    }
  }

  private translateRequest(req: IncomingMessage, signal: AbortSignal): HttpRequest {
    const hops = this.options.trustProxy === true ? 1 : Number(this.options.trustProxy || 0);
    // The value a trusted proxy added: proxies append, so count `hops` entries from the right.
    const forwarded = (name: string): string | undefined => {
      const raw = req.headers[name];
      if (!hops || !raw) return undefined;
      const list = String(raw)
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      return list[Math.max(0, list.length - hops)];
    };

    const protocol =
      forwarded('x-forwarded-proto') === 'https' ||
      (req.socket as { encrypted?: boolean })?.encrypted
        ? 'https'
        : 'http';
    // The Host header is client input: it must never change the path (`Host: x/admin?`).
    const rawHost = forwarded('x-forwarded-host') ?? req.headers.host ?? '';
    const host = VALID_HOST.test(rawHost) ? rawHost : 'localhost';
    const target = req.url ?? '/';
    const pathAndQuery = target.startsWith('/')
      ? target
      : (() => {
          const u = new URL(target, 'http://localhost'); // absolute-form request target
          return u.pathname + u.search;
        })();
    const fullUrl = `${protocol}://${host}${pathAndQuery}`;

    const headersRecord: Record<string, string | readonly string[] | undefined> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (Array.isArray(val)) {
        headersRecord[key] = val;
      } else if (typeof val === 'string') {
        headersRecord[key] = val;
      }
    }

    return new HttpRequest({
      method: (req.method ?? 'GET').toUpperCase() as HttpMethod,
      url: fullUrl,
      headers: headersRecord,
      // IncomingMessage is already an AsyncIterable of Buffers (Uint8Arrays): no wrapper needed.
      body: req as AsyncIterable<Uint8Array>,
      maxBodySize: this.options.maxBodySize,
      ip: forwarded('x-forwarded-for') ?? req.socket.remoteAddress,
      protocol,
      signal,
    });
  }

  private async sendResponse(response: HttpResponse, res: ServerResponse): Promise<void> {
    response.markCommitted();

    res.statusCode = response.statusCode;

    // Apply headers
    for (const [key, val] of response.headers.entries()) {
      res.setHeader(key, val);
    }

    // Apply cookies
    const cookies = response.cookies;
    if (cookies.length > 0) {
      res.setHeader('Set-Cookie', cookies.length === 1 ? cookies[0]! : [...cookies]);
    }

    const body = response.body;

    if (body === null || typeof body === 'undefined') {
      res.end();
      response.markCompleted();
      return;
    }

    if (typeof body === 'string') {
      res.end(body);
      response.markCompleted();
      return;
    }

    if (body instanceof Uint8Array) {
      res.end(Buffer.from(body.buffer, body.byteOffset, body.byteLength));
      response.markCompleted();
      return;
    }

    // Stream response (web ReadableStream or AsyncIterable). Leaving the loop early (client gone)
    // cancels the source, so e.g. an LLM stream stops instead of generating for nobody.
    const chunks = body as AsyncIterable<Uint8Array>;
    for await (const chunk of chunks) {
      if (res.destroyed) break;
      if (!res.write(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength))) {
        await Promise.race([once(res, 'drain'), once(res, 'close')]);
      }
    }
    res.end();
    response.markCompleted();
  }
}

export function createNodeHttpServer(
  handler: HttpServerHandler,
  options?: NodeHttpServerOptions
): IHttpServer {
  return new NodeHttpServer(handler, options);
}
