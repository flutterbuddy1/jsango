import type { RouteHandler } from '@jsango/router';
import type { RequestContext } from '@jsango/http';
import { HttpResponse, HttpStatus } from '@jsango/http';
import type { DiagnosticInfo, DiagnosticComponentStatus } from './types.js';

export type ComponentDiagnosticsProvider = () =>
  Promise<DiagnosticComponentStatus> | DiagnosticComponentStatus;

export class DiagnosticsProvider {
  private readonly componentProviders = new Map<string, ComponentDiagnosticsProvider>();

  public registerComponent(name: string, provider: ComponentDiagnosticsProvider): this {
    this.componentProviders.set(name, provider);
    return this;
  }

  public async getDiagnostics(): Promise<DiagnosticInfo> {
    const memory = process.memoryUsage
      ? process.memoryUsage()
      : { heapUsed: 0, heapTotal: 0, rss: 0 };
    const uptimeSeconds = Math.round(process.uptime ? process.uptime() : 0);

    const isBun = typeof (globalThis as unknown as { Bun?: unknown }).Bun !== 'undefined';
    const runtimeName = isBun ? 'bun' : 'node';
    const runtimeVersion = isBun
      ? String((globalThis as unknown as { Bun: { version: string } }).Bun.version)
      : process.version;

    const components: Record<string, DiagnosticComponentStatus> = {};

    for (const [name, provider] of this.componentProviders.entries()) {
      try {
        components[name] = await provider();
      } catch (err: unknown) {
        components[name] = {
          status: 'error',
          details: { error: err instanceof Error ? err.message : String(err) },
        };
      }
    }

    return {
      uptimeSeconds,
      timestamp: new Date().toISOString(),
      runtime: {
        name: runtimeName,
        version: runtimeVersion,
        platform: process.platform ?? 'unknown',
        nodeVersion: process.version,
      },
      memory: {
        heapUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / (1024 * 1024)) * 100) / 100,
        rssMb: Math.round((memory.rss / (1024 * 1024)) * 100) / 100,
      },
      components,
    };
  }
}

export interface DiagnosticsHandlerOptions {
  readonly isAuthorized?: (ctx: RequestContext) => Promise<boolean> | boolean | undefined;
}

/**
 * Creates an HTTP RouteHandler for diagnostics (/diagnostics).
 * Always requires authorization before revealing internal process/runtime state.
 */
export function createDiagnosticsHandler(
  provider: DiagnosticsProvider,
  options: DiagnosticsHandlerOptions = {}
): RouteHandler {
  return async (ctx: RequestContext) => {
    const isAuth = options.isAuthorized ? await options.isAuthorized(ctx) : false;
    if (!isAuth) {
      return HttpResponse.json(
        {
          error: {
            code: 'ERR_OBSERVABILITY_UNAUTHORIZED',
            message: 'Diagnostics access requires authorization.',
          },
        },
        { status: HttpStatus.FORBIDDEN }
      );
    }

    const info = await provider.getDiagnostics();
    return HttpResponse.json(info, { status: HttpStatus.OK });
  };
}
