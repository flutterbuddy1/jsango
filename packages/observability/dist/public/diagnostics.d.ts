import type { RouteHandler } from '@jsango/router';
import type { RequestContext } from '@jsango/http';
import type { DiagnosticInfo, DiagnosticComponentStatus } from './types.js';
export type ComponentDiagnosticsProvider = () => Promise<DiagnosticComponentStatus> | DiagnosticComponentStatus;
export declare class DiagnosticsProvider {
    private readonly componentProviders;
    registerComponent(name: string, provider: ComponentDiagnosticsProvider): this;
    getDiagnostics(): Promise<DiagnosticInfo>;
}
export interface DiagnosticsHandlerOptions {
    readonly isAuthorized?: (ctx: RequestContext) => Promise<boolean> | boolean | undefined;
}
/**
 * Creates an HTTP RouteHandler for diagnostics (/diagnostics).
 * Always requires authorization before revealing internal process/runtime state.
 */
export declare function createDiagnosticsHandler(provider: DiagnosticsProvider, options?: DiagnosticsHandlerOptions): RouteHandler;
//# sourceMappingURL=diagnostics.d.ts.map