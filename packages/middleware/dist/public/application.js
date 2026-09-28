import { HttpResponse, HttpStatus, RequestContext, createNodeHttpServer, formatHttpErrorResponse, } from '@jsango/http';
import { NoopLogger } from '@jsango/core';
import { Container } from '@jsango/container';
import { Router, } from '@jsango/router';
import { MiddlewarePipeline } from '../internal/pipeline.js';
import { MiddlewareRegistry } from '../internal/registry.js';
import { ResponseNormalizer } from '../internal/normalizer.js';
export class Application {
    router;
    container;
    logger;
    isProduction;
    globalPipeline = new MiddlewarePipeline();
    registry = new MiddlewareRegistry();
    customErrorHandler;
    constructor(options = {}) {
        this.logger = options.logger ?? new NoopLogger();
        this.isProduction = options.isProduction ?? true;
        this.container = options.container ?? new Container();
        this.router = options.router ?? new Router();
    }
    /**
     * Registers one or more global middlewares.
     */
    use(...middleware) {
        for (const mw of middleware) {
            const resolved = this.registry.resolve(mw);
            this.globalPipeline.use(resolved);
        }
        return this;
    }
    /**
     * Registers a named middleware in the registry.
     */
    registerMiddleware(name, middleware) {
        this.registry.register(name, middleware);
        return this;
    }
    /**
     * Sets a custom error handler for the application.
     */
    setErrorHandler(handler) {
        this.customErrorHandler = handler;
        return this;
    }
    // --- Router Convenience Delegation ---
    get(path, handler, options) {
        return this.router.get(path, handler, options);
    }
    post(path, handler, options) {
        return this.router.post(path, handler, options);
    }
    put(path, handler, options) {
        return this.router.put(path, handler, options);
    }
    patch(path, handler, options) {
        return this.router.patch(path, handler, options);
    }
    delete(path, handler, options) {
        return this.router.delete(path, handler, options);
    }
    head(path, handler, options) {
        return this.router.head(path, handler, options);
    }
    options(path, handler, options) {
        return this.router.options(path, handler, options);
    }
    group(prefixOrConfig, callback, options) {
        this.router.group(prefixOrConfig, callback, options);
        return this;
    }
    // --- Request Lifecycle Entry Point ---
    /**
     * Handles an incoming HttpRequest or RequestContext through the entire application lifecycle.
     */
    async handle(input) {
        const ctx = input instanceof RequestContext
            ? input
            : new RequestContext({
                request: input,
                logger: this.logger,
                signal: input.signal,
            });
        // Create request-scoped dependency injection container
        const requestScope = this.container.createScope();
        ctx.container = requestScope;
        try {
            // Execute global middleware pipeline with route dispatcher as terminal handler
            const response = await this.globalPipeline.execute(ctx, async (c) => {
                try {
                    return await this.dispatchRoute(c);
                }
                catch (routeError) {
                    return this.handleError(routeError, c);
                }
            });
            return response;
        }
        catch (pipelineError) {
            // If a global middleware itself throws without catching
            return this.handleError(pipelineError, ctx);
        }
        finally {
            // Ensure request scope is always disposed to prevent leaks
            await requestScope.dispose();
        }
    }
    async handleError(error, ctx) {
        this.logger.error('Request pipeline execution error', {
            requestId: ctx.requestId,
            error: error instanceof Error ? error.message : String(error),
        });
        if (this.customErrorHandler) {
            try {
                const customResult = await this.customErrorHandler(error, ctx);
                return ResponseNormalizer.normalize(customResult, ctx);
            }
            catch (secondaryError) {
                return this.formatDefaultError(secondaryError);
            }
        }
        return this.formatDefaultError(error);
    }
    /**
     * Starts a NodeHttpServer bound to the application.
     */
    async listen(port = 3000, host = '127.0.0.1') {
        const server = createNodeHttpServer(async (ctx) => this.handle(ctx), {
            logger: this.logger,
            isProduction: this.isProduction,
        });
        await server.listen(port, host);
        return server;
    }
    async dispatchRoute(ctx) {
        const match = this.router.match(ctx.request.method, ctx.request.pathname);
        // 1. MATCHED Route
        if (match.type === 'MATCHED') {
            // Set matched route parameters on request
            ctx.request.params = match.params;
            ctx.state.set('route', match.route);
            // Resolve route-level middleware (includes inherited group middleware)
            const routeMiddlewareDefs = (match.route.middleware ?? []);
            const resolvedMiddleware = this.registry.resolveAll(routeMiddlewareDefs);
            let response;
            if (resolvedMiddleware.length > 0) {
                // Execute route-level middleware pipeline
                const routePipeline = new MiddlewarePipeline(resolvedMiddleware);
                response = await routePipeline.execute(ctx, async (c) => {
                    const raw = await match.handler(c);
                    return ResponseNormalizer.normalize(raw, c);
                });
            }
            else {
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
            return HttpResponse.json({
                error: {
                    code: 'ERR_HTTP_METHOD_NOT_ALLOWED',
                    message: `Method ${ctx.request.method} is not allowed for path "${ctx.request.pathname}".`,
                },
            }, {
                status: HttpStatus.METHOD_NOT_ALLOWED,
                headers: {
                    allow: allowHeader,
                },
            });
        }
        // 3. NOT_FOUND (404) - Route middleware does NOT execute
        return HttpResponse.json({
            error: {
                code: 'ERR_HTTP_NOT_FOUND',
                message: `Cannot ${ctx.request.method} ${ctx.request.pathname}`,
            },
        }, { status: HttpStatus.NOT_FOUND });
    }
    formatDefaultError(error) {
        const formatted = formatHttpErrorResponse(error, this.isProduction);
        return HttpResponse.json(formatted.body, { status: formatted.statusCode });
    }
}
//# sourceMappingURL=application.js.map