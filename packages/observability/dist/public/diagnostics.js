import { HttpResponse, HttpStatus } from '@jsango/http';
export class DiagnosticsProvider {
    componentProviders = new Map();
    registerComponent(name, provider) {
        this.componentProviders.set(name, provider);
        return this;
    }
    async getDiagnostics() {
        const memory = process.memoryUsage
            ? process.memoryUsage()
            : { heapUsed: 0, heapTotal: 0, rss: 0 };
        const uptimeSeconds = Math.round(process.uptime ? process.uptime() : 0);
        const isBun = typeof globalThis.Bun !== 'undefined';
        const runtimeName = isBun ? 'bun' : 'node';
        const runtimeVersion = isBun
            ? String(globalThis.Bun.version)
            : process.version;
        const components = {};
        for (const [name, provider] of this.componentProviders.entries()) {
            try {
                components[name] = await provider();
            }
            catch (err) {
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
/**
 * Creates an HTTP RouteHandler for diagnostics (/diagnostics).
 * Always requires authorization before revealing internal process/runtime state.
 */
export function createDiagnosticsHandler(provider, options = {}) {
    return async (ctx) => {
        const isAuth = options.isAuthorized ? await options.isAuthorized(ctx) : false;
        if (!isAuth) {
            return HttpResponse.json({
                error: {
                    code: 'ERR_OBSERVABILITY_UNAUTHORIZED',
                    message: 'Diagnostics access requires authorization.',
                },
            }, { status: HttpStatus.FORBIDDEN });
        }
        const info = await provider.getDiagnostics();
        return HttpResponse.json(info, { status: HttpStatus.OK });
    };
}
//# sourceMappingURL=diagnostics.js.map