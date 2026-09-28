import type { RequestContext } from '@jsango/http';
import { MetricRegistry } from './metrics.js';
import { Tracer } from './tracing.js';
import { StructuredLogger } from './logger.js';
export interface HttpInstrumentationOptions {
    readonly metrics?: MetricRegistry | undefined;
    readonly tracer?: Tracer | undefined;
    readonly logger?: StructuredLogger | undefined;
    readonly includeTraceHeaders?: boolean | undefined;
}
export type MiddlewareNext = () => Promise<void>;
/**
 * Creates HTTP request instrumentation middleware.
 * Automatically handles request ID correlation, tracing span, metric increments, and structured logging.
 */
export declare function createHttpInstrumentationMiddleware(options?: HttpInstrumentationOptions): (ctx: RequestContext, next: MiddlewareNext) => Promise<void>;
export declare class FrameworkInstrumentation {
    /**
     * Database operation instrumentation hook.
     */
    static createDatabaseHook(metrics?: MetricRegistry, tracer?: Tracer): <T>(operation: string, queryFn: () => Promise<T>) => Promise<T>;
    /**
     * Cache operation instrumentation hook.
     */
    static createCacheHook(metrics?: MetricRegistry): {
        recordHit(operation?: string): void;
        recordMiss(operation?: string): void;
        recordSet(): void;
        recordDelete(): void;
    };
    /**
     * Queue job instrumentation hook.
     */
    static createQueueHook(metrics?: MetricRegistry, tracer?: Tracer): <T>(jobName: string, executeFn: () => Promise<T>) => Promise<T>;
}
//# sourceMappingURL=instrumentation.d.ts.map