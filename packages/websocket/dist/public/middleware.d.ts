import type { WebSocketInboundMessage, WebSocketMiddlewareHandler } from './types.js';
import type { WebSocketContext } from './context.js';
export declare class WebSocketMiddlewarePipeline {
    private readonly middlewares;
    use(...handlers: WebSocketMiddlewareHandler[]): this;
    execute(ctx: WebSocketContext, message: WebSocketInboundMessage, target: () => Promise<void>): Promise<void>;
}
//# sourceMappingURL=middleware.d.ts.map