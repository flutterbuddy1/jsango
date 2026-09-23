import type { RequestContext } from './context.js';
import type { HttpResponse } from './response.js';

export type HttpServerHandler = (ctx: RequestContext) => Promise<HttpResponse> | HttpResponse;

export interface ServerAddress {
  readonly port: number;
  readonly host: string;
  readonly family: string;
}

export interface IHttpServer {
  readonly isListening: boolean;
  readonly address: ServerAddress | null;
  listen(port?: number, host?: string): Promise<ServerAddress>;
  close(timeoutMs?: number): Promise<void>;
}
