import { HttpResponse, HttpStatus } from '@jsango/http';
export class HealthRegistry {
    checks = new Map();
    register(name, fn, options = {}) {
        this.checks.set(name, {
            name,
            fn,
            timeoutMs: options.timeoutMs ?? 5000,
            critical: options.critical ?? true,
        });
        return this;
    }
    unregister(name) {
        return this.checks.delete(name);
    }
    async check(name) {
        const check = this.checks.get(name);
        if (!check) {
            return {
                status: 'unhealthy',
                durationMs: 0,
                error: `Health check "${name}" is not registered.`,
            };
        }
        return this.runSingleCheck(check);
    }
    async checkAll() {
        const start = performance.now();
        const results = {};
        const checkPromises = Array.from(this.checks.values()).map(async (check) => {
            const res = await this.runSingleCheck(check);
            return { name: check.name, result: res, critical: check.critical };
        });
        const settled = await Promise.allSettled(checkPromises);
        let overallStatus = 'healthy';
        for (const item of settled) {
            if (item.status === 'fulfilled') {
                const { name, result, critical } = item.value;
                results[name] = result;
                if (result.status === 'unhealthy') {
                    if (critical) {
                        overallStatus = 'unhealthy';
                    }
                    else if (overallStatus !== 'unhealthy') {
                        overallStatus = 'degraded';
                    }
                }
                else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
                    overallStatus = 'degraded';
                }
            }
            else {
                overallStatus = 'unhealthy';
            }
        }
        const durationMs = Math.round(performance.now() - start);
        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            durationMs,
            checks: results,
        };
    }
    async runSingleCheck(check) {
        const start = performance.now();
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), check.timeoutMs);
        try {
            const outcome = await Promise.race([
                check.fn(controller.signal),
                new Promise((_, reject) => {
                    controller.signal.addEventListener('abort', () => reject(new Error(`Health check "${check.name}" timed out after ${check.timeoutMs}ms.`)));
                }),
            ]);
            clearTimeout(timer);
            const durationMs = Math.round(performance.now() - start);
            if (typeof outcome === 'boolean') {
                return {
                    status: outcome ? 'healthy' : 'unhealthy',
                    durationMs,
                };
            }
            return {
                status: outcome.status,
                durationMs,
                details: outcome.details,
                error: outcome.error,
            };
        }
        catch (err) {
            clearTimeout(timer);
            const durationMs = Math.round(performance.now() - start);
            return {
                status: 'unhealthy',
                durationMs,
                error: err instanceof Error ? err.message : String(err),
            };
        }
    }
}
/**
 * Creates an HTTP endpoint handler for health checks (/health, /health/live, /health/ready).
 * Masks internal diagnostic details for public/unauthorized requests to prevent information disclosure.
 */
export function createHealthHandler(registry, options = {}) {
    return async (ctx) => {
        const health = await registry.checkAll();
        const httpStatus = health.status === 'unhealthy' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;
        const authorized = options.isAuthorized ? await options.isAuthorized(ctx) : false;
        if (!authorized) {
            // Minimal, safe public response
            return HttpResponse.json({
                status: health.status,
                timestamp: health.timestamp,
            }, { status: httpStatus });
        }
        // Full detailed response for authorized operators
        return HttpResponse.json(health, { status: httpStatus });
    };
}
//# sourceMappingURL=health.js.map