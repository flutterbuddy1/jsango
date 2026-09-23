import type { HttpRequest, IHttpServer } from '@django-js/http';
import {
  HttpResponse,
  HttpStatus,
  RequestContext,
  createNodeHttpServer,
  formatHttpErrorResponse,
} from '@django-js/http';
import type { ILogger } from '@django-js/core';
import { NoopLogger } from '@django-js/core';
import { Container } from '@django-js/container';
import {
  Router,
  Route,
  type RouteHandler,
  type RouteOptions,
  type RouteGroup,
  type RouteGroupConfig,
  type RouteGroupOptions,
  type RouteMatchResult,
} from '@django-js/router';
import type {
  ApplicationOptions,
  ErrorHandler,
  Middleware,
  MiddlewareDefinition,
} from './types.js';
import { MiddlewarePipeline } from '../internal/pipeline.js';
import { MiddlewareRegistry } from '../internal/registry.js';
import { ResponseNormalizer } from '../internal/normalizer.js';

export class Application {
  public readonly router: Router;
  public readonly container: Container;
  public readonly logger: ILogger;
  public readonly isProduction: boolean;

  private readonly globalPipeline = new MiddlewarePipeline();
  private readonly registry = new MiddlewareRegistry();
  private customErrorHandler?: ErrorHandler | undefined;

  constructor(options: ApplicationOptions = {}) {
    this.logger = options.logger ?? new NoopLogger();
    this.isProduction = options.isProduction ?? true;
    this.container = options.container ?? new Container();
    this.router = options.router ?? new Router();
  }

  /**
   * Registers one or more global middlewares.
   */
  public use(...middleware: MiddlewareDefinition[]): this {
    for (const mw of middleware) {
      const resolved = this.registry.resolve(mw);
      this.globalPipeline.use(resolved);
    }
    return this;
  }

  /**
   * Registers a named middleware in the registry.
   */
  public registerMiddleware(name: string, middleware: Middleware): this {
    this.registry.register(name, middleware);
    return this;
  }

  /**
   * Sets a custom error handler for the application.
   */
  public setErrorHandler(handler: ErrorHandler): this {
    this.customErrorHandler = handler;
    return this;
  }

  // --- Router Convenience Delegation ---

  public get(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.get(path, handler, options);
  }

  public post(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.post(path, handler, options);
  }

  public put(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.put(path, handler, options);
  }

  public patch(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.patch(path, handler, options);
  }

  public delete(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.delete(path, handler, options);
  }

  public head(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.head(path, handler, options);
  }

  public options(path: string, handler: RouteHandler, options?: RouteOptions): Route {
    return this.router.options(path, handler, options);
  }

  public group(
    prefixOrConfig: string | RouteGroupConfig,
    callback: (group: RouteGroup) => void,
    options?: RouteGroupOptions
  ): this {
    this.router.group(prefixOrConfig, callback, options);
    return this;
  }

  // --- Request Lifecycle Entry Point ---

  /**
   * Handles an incoming HttpRequest or RequestContext through the entire application lifecycle.
   */
  public async handle(input: HttpRequest | RequestContext): Promise<HttpResponse> {
    const ctx =
      input instanceof RequestContext
        ? input
        : new RequestContext({
            request: input,
            logger: this.logger,
            signal: input.signal,
          });

    // Create request-scoped dependency injection container
    const requestScope = this.container.createScope();
    (ctx as unknown as { container?: Container }).container = requestScope;

    try {
      // Execute global middleware pipeline with route dispatcher as terminal handler
      const response = await this.globalPipeline.execute(ctx, async (c) => {
        try {
          return await this.dispatchRoute(c);
        } catch (routeError) {
          return this.handleError(routeError, c);
        }
      });

      return response;
    } catch (pipelineError) {
      // If a global middleware itself throws without catching
      return this.handleError(pipelineError, ctx);
    } finally {
      // Ensure request scope is always disposed to prevent leaks
      await requestScope.dispose();
    }
  }

  private async handleError(error: unknown, ctx: RequestContext): Promise<HttpResponse> {
    this.logger.error('Request pipeline execution error', {
      requestId: ctx.requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    if (this.customErrorHandler) {
      try {
        const customResult = await this.customErrorHandler(error, ctx);
        return ResponseNormalizer.normalize(customResult, ctx);
      } catch (secondaryError) {
        return this.formatDefaultError(secondaryError);
      }
    }

    return this.formatDefaultError(error);
  }

  /**
   * Starts a NodeHttpServer bound to the application.
   */
  public async listen(port = 3000, host = '127.0.0.1'): Promise<IHttpServer> {
    const server = createNodeHttpServer(async (ctx) => this.handle(ctx), {
      logger: this.logger,
      isProduction: this.isProduction,
    });
    await server.listen(port, host);
    return server;
  }

  private async dispatchRoute(ctx: RequestContext): Promise<HttpResponse> {
    const match: RouteMatchResult = this.router.match(ctx.request.method, ctx.request.pathname);

    // 1. MATCHED Route
    if (match.type === 'MATCHED') {
      // Set matched route parameters on request
      (ctx.request as { params: Readonly<Record<string, string>> }).params = match.params;
      ctx.state.set('route', match.route);

      // Resolve route-level middleware (includes inherited group middleware)
      const routeMiddlewareDefs = (match.route.middleware ?? []) as readonly MiddlewareDefinition[];
      const resolvedMiddleware = this.registry.resolveAll(routeMiddlewareDefs);

      let response: HttpResponse;

      if (resolvedMiddleware.length > 0) {
        // Execute route-level middleware pipeline
        const routePipeline = new MiddlewarePipeline(resolvedMiddleware);
        response = await routePipeline.execute(ctx, async (c) => {
          const raw = await match.handler(c);
          return ResponseNormalizer.normalize(raw, c);
        });
      } else {
        const raw = await match.handler(ctx);
        response = ResponseNormalizer.normalize(raw, ctx);
      }

      // If HEAD fallback matched a GET route, suppress response body per RFC 7231
      if (match.isHeadFallback && ctx.request.method === 'HEAD') {
        response.body = null;
      }

      return response;
    }

    // 2. METHOD_NOT_ALLOWED (405) - Route middleware does NOT execute
    if (match.type === 'METHOD_NOT_ALLOWED') {
      const allowHeader = match.allowedMethods.join(', ');
      return HttpResponse.json(
        {
          error: {
            code: 'ERR_HTTP_METHOD_NOT_ALLOWED',
            message: `Method ${ctx.request.method} is not allowed for path "${ctx.request.pathname}".`,
          },
        },
        {
          status: HttpStatus.METHOD_NOT_ALLOWED,
          headers: {
            allow: allowHeader,
          },
        }
      );
    }

    // 3. NOT_FOUND (404) - Route middleware does NOT execute
    return HttpResponse.json(
      {
        error: {
          code: 'ERR_HTTP_NOT_FOUND',
          message: `Cannot ${ctx.request.method} ${ctx.request.pathname}`,
        },
      },
      { status: HttpStatus.NOT_FOUND }
    );
  }

  private formatDefaultError(error: unknown): HttpResponse {
    const formatted = formatHttpErrorResponse(error, this.isProduction);
    return HttpResponse.json(formatted.body, { status: formatted.statusCode });
  }
}
