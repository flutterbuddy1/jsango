import type { EventDefinition, EventMiddlewareHandler } from './types.js';
/**
 * Onion-style event middleware pipeline.
 * Separate from HTTP middleware and Queue middleware.
 */
export declare class EventMiddlewarePipeline {
    private readonly handlers;
    constructor(handlers?: readonly EventMiddlewareHandler[]);
    use(...handlers: EventMiddlewareHandler[]): this;
    execute(event: EventDefinition, terminal: () => Promise<void>): Promise<void>;
    get length(): number;
}
//# sourceMappingURL=middleware.d.ts.map