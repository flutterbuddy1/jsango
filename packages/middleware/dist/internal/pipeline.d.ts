import type { HttpResponse, RequestContext } from '@jsango/http';
import type { Middleware } from '../public/types.js';
export declare class MiddlewarePipeline {
    private readonly stack;
    constructor(middlewares?: readonly Middleware[]);
    use(...middleware: Middleware[]): this;
    get length(): number;
    execute(ctx: RequestContext, terminalHandler: (ctx: RequestContext) => Promise<HttpResponse>): Promise<HttpResponse>;
}
//# sourceMappingURL=pipeline.d.ts.map