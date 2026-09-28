import { Application as MiddlewareApplication, type ApplicationOptions, type MiddlewareDefinition, type ErrorHandler } from '@jsango/middleware';
import { HttpRequest, HttpResponse, RequestContext, type IHttpServer } from '@jsango/http';
import type { RouteGroup, RouteGroupConfig, RouteGroupOptions } from '@jsango/router';
import { type DefinedModelStatic, type Model } from '@jsango/orm';
import { Agent } from '@jsango/ai';
import { type WebSocketRouteCallback } from './websocket-wrapper.js';
export interface CrudOptions {
    readonly searchFields?: readonly string[];
    readonly defaultPageSize?: number;
    readonly maxPageSize?: number;
}
export interface AdminOptions {
    readonly prefix?: string;
    readonly resources?: readonly (DefinedModelStatic<any, any> | Model)[];
}
export interface OpenApiOptions {
    readonly path?: string;
    readonly title?: string;
    readonly version?: string;
    readonly description?: string;
}
export declare class JSangoApplication {
    readonly app: MiddlewareApplication;
    private readonly wsManager;
    private readonly openapiRegistry;
    private isProduction;
    constructor(options?: ApplicationOptions);
    use(...middleware: MiddlewareDefinition[]): this;
    registerMiddleware(name: string, middleware: any): this;
    setErrorHandler(handler: ErrorHandler): this;
    get(path: string, ...handlers: any[]): this;
    post(path: string, ...handlers: any[]): this;
    put(path: string, ...handlers: any[]): this;
    patch(path: string, ...handlers: any[]): this;
    delete(path: string, ...handlers: any[]): this;
    head(path: string, ...handlers: any[]): this;
    options(path: string, ...handlers: any[]): this;
    group(prefixOrConfig: string | RouteGroupConfig, callback: (group: RouteGroup) => void, options?: RouteGroupOptions): this;
    ws(path: string, callback: WebSocketRouteCallback): this;
    crud(basePath: string, modelClass: DefinedModelStatic<any, any>, options?: CrudOptions): this;
    admin(options?: AdminOptions): this;
    openapi(options?: OpenApiOptions): this;
    /**
     * Mounts an AI Agent as an HTTP endpoint.
     * Handles POST /agent with JSON { input, conversationId, context }
     * and GET /agent?input=... with optional Server-Sent Events (SSE) streaming.
     */
    agent(path: string, targetAgent: Agent, options?: {
        maxSteps?: number;
    }): this;
    /**
     * Mounts an AI Agent as a Real-time WebSocket endpoint.
     * Streams token deltas, tool calls, and progress events automatically.
     */
    wsAgent(path: string, targetAgent: Agent): this;
    handle(input: HttpRequest | RequestContext): Promise<HttpResponse>;
    listen(port?: number, host?: string): Promise<IHttpServer>;
}
/**
 * Creates and configures a new JSango application instance.
 */
export declare function createApp(options?: ApplicationOptions): JSangoApplication;
//# sourceMappingURL=application.d.ts.map