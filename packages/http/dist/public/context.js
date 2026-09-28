import { NoopLogger } from '@jsango/core';
import { HttpResponse } from './response.js';
export class RequestContext {
    request;
    response;
    requestId;
    logger;
    container;
    signal;
    state = new Map();
    constructor(init) {
        this.request = init.request;
        this.response = init.response ?? new HttpResponse();
        this.requestId = init.requestId ?? init.request.requestId;
        this.logger = init.logger ?? new NoopLogger();
        this.container = init.container;
        this.signal = init.signal ?? init.request.signal;
    }
}
//# sourceMappingURL=context.js.map