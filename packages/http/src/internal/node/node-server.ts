import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
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
}

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

    req.on('close', () => {
      if (!res.writableEnded) {
        abortController.abort();
      }
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
    } finally {
      this.activeControllers.delete(abortController);
      this.activeRequests--;
    }
  }

  private translateRequest(req: IncomingMessage, signal: AbortSignal): HttpRequest {
    const protocol = (req.socket as { encrypted?: boolean })?.encrypted ? 'https' : 'http';
    const host = req.headers.host ?? 'localhost';
    const fullUrl = `${protocol}://${host}${req.url ?? '/'}`;

    const headersRecord: Record<string, string | readonly string[] | undefined> = {};
    for (const [key, val] of Object.entries(req.headers)) {
      if (Array.isArray(val)) {
        headersRecord[key] = val;
      } else if (typeof val === 'string') {
        headersRecord[key] = val;
      }
    }

    // Convert IncomingMessage readable stream to AsyncIterable<Uint8Array>
    async function* toAsyncIterable(stream: IncomingMessage): AsyncIterable<Uint8Array> {
      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          yield new TextEncoder().encode(chunk);
        } else if (Buffer.isBuffer(chunk)) {
          yield new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        } else if (chunk instanceof Uint8Array) {
          yield chunk;
        }
      }
    }

    return new HttpRequest({
      method: (req.method ?? 'GET').toUpperCase() as HttpMethod,
      url: fullUrl,
      headers: headersRecord,
      body: toAsyncIterable(req),
      maxBodySize: this.options.maxBodySize,
      ip: req.socket.remoteAddress,
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

    // Stream response
    if ('getReader' in body) {
      const reader = (body as ReadableStream<Uint8Array>).getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            res.write(Buffer.from(value.buffer, value.byteOffset, value.byteLength));
          }
        }
      } finally {
        reader.releaseLock();
      }
      res.end();
      response.markCompleted();
      return;
    }

    // AsyncIterable stream
    for await (const chunk of body as AsyncIterable<Uint8Array>) {
      res.write(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength));
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
