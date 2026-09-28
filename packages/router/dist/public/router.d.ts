import type { HttpMethod, RequestContext } from '@jsango/http';
import { HttpResponse } from '@jsango/http';
import { Route, type RouteHandler, type RouteOptions } from './route.js';
import { RouteGroup, type RouteGroupConfig, type RouteGroupOptions } from './group.js';
import type { IRouter } from './router-interface.js';
import type { RouteMatchResult } from './result.js';
export type RouterState = 'registering' | 'compiled' | 'locked';
export declare class Router implements IRouter {
    private readonly tree;
    private readonly registeredRoutes;
    private readonly namedRoutes;
    private _state;
    get state(): RouterState;
    get isLocked(): boolean;
    compile(): this;
    lock(): this;
    private assertNotLocked;
    route(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions): Route;
    private registerRouteName;
    get(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    post(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    put(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    patch(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    delete(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    head(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    options(path: string, handler: RouteHandler, options?: RouteOptions): Route;
    group(prefixOrConfig: string | RouteGroupConfig, callback: (group: RouteGroup) => void, options?: RouteGroupOptions): this;
    match(method: HttpMethod, path: string): RouteMatchResult;
    routes(): readonly Route[];
    getRouteByName(name: string): Route | undefined;
    url(name: string, params?: Record<string, string | number>): string;
    /**
     * Dispatches a RequestContext against the route table and returns the resulting HttpResponse.
     */
    handle(ctx: RequestContext): Promise<HttpResponse>;
}
//# sourceMappingURL=router.d.ts.map