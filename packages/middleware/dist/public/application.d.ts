import type { HttpRequest, IHttpServer } from '@jsango/http';
import { HttpResponse, RequestContext } from '@jsango/http';
import type { ILogger } from '@jsango/core';
import { Container } from '@jsango/container';
import { Router, Route, type RouteHandler, type RouteOptions, type RouteGroup, type RouteGroupConfig, type RouteGroupOptions } from '@jsango/router';
import type { ApplicationOptions, ErrorHandler, Middleware, MiddlewareDefinition } from './types.js';
export declare class Application {
    readonly router: Router;
    readonly container: Container;
    readonly logger: ILogger;
    readonly isProduction: boolean;
    private readonly globalPipeline;
    private readonly registry;
    private customErrorHandler?;
    constructor(options?: ApplicationOptions);
    /**
     * Registers one or more global middlewares.
     */
    use(...middleware: MiddlewareDefinition[]): this;
    /**
     * Registers a named middleware in the registry.
     */
    registerMiddleware(name: string, middleware: Middleware): this;
    /**
     * Sets a custom error handler for the application.
     */
    setErrorHandler(handler: ErrorHandler): this;
    get(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    post(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    put(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    patch(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    delete(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    head(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    options(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    group(prefixOrConfig: string | RouteGroupConfig, callback: (group: RouteGroup) => void, options?: RouteGroupOptions): this;
    /**
     * Handles an incoming HttpRequest or RequestContext through the entire application lifecycle.
     */
    handle(input: HttpRequest | RequestContext): Promise<HttpResponse>;
    private handleError;
    /**
     * Starts a NodeHttpServer bound to the application.
     */
    listen(port?: number, host?: string): Promise<IHttpServer>;
    private dispatchRoute;
    private formatDefaultError;
}
//# sourceMappingURL=application.d.ts.map