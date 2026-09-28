import type { HttpMethod, HttpResponse, RequestContext } from '@jsango/http';
import type { RouteConstraintDefinition } from './constraints.js';
export type RouteHandler = (ctx: RequestContext) => Promise<HttpResponse | unknown> | HttpResponse | unknown;
export interface RouteOptions {
    readonly name?: string | undefined;
    readonly metadata?: Record<string, unknown> | undefined;
    readonly constraints?: Record<string, RouteConstraintDefinition> | undefined;
    readonly middleware?: readonly unknown[] | undefined;
}
export declare class Route {
    readonly method: HttpMethod;
    readonly path: string;
    readonly handler: RouteHandler;
    readonly metadata: Readonly<Record<string, unknown>>;
    readonly constraints: Readonly<Record<string, RouteConstraintDefinition>>;
    readonly paramNames: readonly string[];
    readonly middleware: readonly unknown[];
    private _name?;
    constructor(method: HttpMethod, path: string, handler: RouteHandler, options?: RouteOptions, paramNames?: readonly string[]);
    get routeName(): string | undefined;
    /**
     * Fluent method to assign or update the route's unique name.
     */
    name(name: string): this;
}
//# sourceMappingURL=route.d.ts.map