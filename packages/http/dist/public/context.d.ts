import type { ILogger } from '@jsango/core';
import type { IContainer } from '@jsango/container';
import type { HttpRequest } from './request.js';
import { HttpResponse } from './response.js';
export interface RequestContextInit {
    readonly request: HttpRequest;
    readonly response?: HttpResponse | undefined;
    readonly requestId?: string | undefined;
    readonly logger?: ILogger | undefined;
    readonly container?: IContainer | undefined;
    readonly signal?: AbortSignal | undefined;
}
export declare class RequestContext {
    readonly request: HttpRequest;
    response: HttpResponse;
    readonly requestId: string;
    readonly logger: ILogger;
    readonly container?: IContainer | undefined;
    readonly signal: AbortSignal;
    readonly state: Map<string, unknown>;
    constructor(init: RequestContextInit);
}
//# sourceMappingURL=context.d.ts.map