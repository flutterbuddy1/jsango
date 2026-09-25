import type { HttpResponse, RequestContext } from '@jsango/http';
import type { ILogger } from '@jsango/core';
import type { Container } from '@jsango/container';
import type { Router } from '@jsango/router';

export type NextFunction = () => Promise<HttpResponse>;

export type MiddlewareHandler = (
  ctx: RequestContext,
  next: NextFunction
) => Promise<HttpResponse | unknown> | HttpResponse | unknown;

export interface IMiddleware {
  handle(
    ctx: RequestContext,
    next: NextFunction
  ): Promise<HttpResponse | unknown> | HttpResponse | unknown;
}

export type Middleware = MiddlewareHandler | IMiddleware;

export type MiddlewareDefinition = Middleware | string;

export type MiddlewareFactory<TOptions = unknown> = (options?: TOptions) => Middleware;

export type ErrorHandler = (
  error: unknown,
  ctx: RequestContext
) => Promise<HttpResponse | unknown> | HttpResponse | unknown;

export interface ApplicationOptions {
  readonly logger?: ILogger | undefined;
  readonly isProduction?: boolean | undefined;
  readonly container?: Container | undefined;
  readonly router?: Router | undefined;
}
