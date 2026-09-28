import type { HttpMethod } from '@jsango/http';
import { Route, type RouteHandler, type RouteOptions } from './route.js';
import type { IRouter } from './router-interface.js';
export interface RouteGroupConfig {
    readonly prefix: string;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly middleware?: readonly unknown[] | undefined;
}
export interface RouteGroupOptions {
    readonly metadata?: Record<string, unknown> | undefined;
    readonly middleware?: readonly unknown[] | undefined;
}
export declare class RouteGroup {
    private readonly router;
    readonly prefix: string;
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly middleware: readonly unknown[];
    constructor(router: IRouter, prefix: string, options?: RouteGroupOptions);
    route(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions): Route;
    get(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    post(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    put(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    patch(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    delete(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    head(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    options(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    group(prefixOrConfig: string | RouteGroupConfig, callback: (group: RouteGroup) => void, options?: RouteGroupOptions): this;
}
//# sourceMappingURL=group.d.ts.map