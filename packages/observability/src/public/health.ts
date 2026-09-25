import type { RouteHandler } from '@jsango/router';
import type { RequestContext } from '@jsango/http';
import { HttpResponse, HttpStatus } from '@jsango/http';
import type {
  HealthStatus,
  HealthResult,
  HealthCheckFn,
  HealthCheckOptions,
  OverallHealth,
} from './types.js';

interface RegisteredCheck {
  readonly name: string;
  readonly fn: HealthCheckFn;
  readonly timeoutMs: number;
  readonly critical: boolean;
}

export class HealthRegistry {
  private readonly checks = new Map<string, RegisteredCheck>();

  public register(
    name: string,
    fn: HealthCheckFn,
    options: Partial<HealthCheckOptions> = {}
  ): this {
    this.checks.set(name, {
      name,
      fn,
      timeoutMs: options.timeoutMs ?? 5000,
      critical: options.critical ?? true,
    });
    return this;
  }

  public unregister(name: string): boolean {
    return this.checks.delete(name);
  }

  public async check(name: string): Promise<HealthResult> {
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

  public async checkAll(): Promise<OverallHealth> {
    const start = performance.now();
    const results: Record<string, HealthResult> = {};

    const checkPromises = Array.from(this.checks.values()).map(async (check) => {
      const res = await this.runSingleCheck(check);
      return { name: check.name, result: res, critical: check.critical };
    });

    const settled = await Promise.allSettled(checkPromises);
    let overallStatus: HealthStatus = 'healthy';

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        const { name, result, critical } = item.value;
        results[name] = result;

        if (result.status === 'unhealthy') {
          if (critical) {
            overallStatus = 'unhealthy';
          } else if (overallStatus !== 'unhealthy') {
            overallStatus = 'degraded';
          }
        } else if (result.status === 'degraded' && overallStatus !== 'unhealthy') {
          overallStatus = 'degraded';
        }
      } else {
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

  private async runSingleCheck(check: RegisteredCheck): Promise<HealthResult> {
    const start = performance.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), check.timeoutMs);

    try {
      const outcome = await Promise.race([
        check.fn(controller.signal),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new Error(`Health check "${check.name}" timed out after ${check.timeoutMs}ms.`))
          );
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
    } catch (err: unknown) {
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

export interface HealthHandlerOptions {
  readonly isAuthorized?: (ctx: RequestContext) => Promise<boolean> | boolean | undefined;
}

/**
 * Creates an HTTP endpoint handler for health checks (/health, /health/live, /health/ready).
 * Masks internal diagnostic details for public/unauthorized requests to prevent information disclosure.
 */
export function createHealthHandler(
  registry: HealthRegistry,
  options: HealthHandlerOptions = {}
): RouteHandler {
  return async (ctx: RequestContext) => {
    const health = await registry.checkAll();
    const httpStatus =
      health.status === 'unhealthy' ? HttpStatus.SERVICE_UNAVAILABLE : HttpStatus.OK;

    const authorized = options.isAuthorized ? await options.isAuthorized(ctx) : false;

    if (!authorized) {
      // Minimal, safe public response
      return HttpResponse.json(
        {
          status: health.status,
          timestamp: health.timestamp,
        },
        { status: httpStatus }
      );
    }

    // Full detailed response for authorized operators
    return HttpResponse.json(health, { status: httpStatus });
  };
}
