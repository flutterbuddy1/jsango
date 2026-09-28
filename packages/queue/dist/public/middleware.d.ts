import type { JobContext } from './types.js';
export type QueueMiddlewareHandler = (context: JobContext, next: () => Promise<void>) => Promise<void>;
/**
 * Onion-style execution pipeline for queue jobs.
 */
export declare class QueueMiddlewarePipeline {
    private readonly handlers;
    constructor(handlers?: readonly QueueMiddlewareHandler[]);
    use(...handlers: QueueMiddlewareHandler[]): this;
    execute(context: JobContext, terminal: () => Promise<void>): Promise<void>;
}
//# sourceMappingURL=middleware.d.ts.map