import type { RouteHandler } from '@jsango/router';
import type { RequestContext } from '@jsango/http';
import type { HealthResult, HealthCheckFn, HealthCheckOptions, OverallHealth } from './types.js';
export declare class HealthRegistry {
    private readonly checks;
    register(name: string, fn: HealthCheckFn, options?: Partial<HealthCheckOptions>): this;
    unregister(name: string): boolean;
    check(name: string): Promise<HealthResult>;
    checkAll(): Promise<OverallHealth>;
    private runSingleCheck;
}
export interface HealthHandlerOptions {
    readonly isAuthorized?: (ctx: RequestContext) => Promise<boolean> | boolean | undefined;
}
/**
 * Creates an HTTP endpoint handler for health checks (/health, /health/live, /health/ready).
 * Masks internal diagnostic details for public/unauthorized requests to prevent information disclosure.
 */
export declare function createHealthHandler(registry: HealthRegistry, options?: HealthHandlerOptions): RouteHandler;
//# sourceMappingURL=health.d.ts.map