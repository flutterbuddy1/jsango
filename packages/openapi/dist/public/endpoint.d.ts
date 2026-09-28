import type { RouteHandler } from '@jsango/router';
import type { IRouter } from '@jsango/router';
import { OpenApiGenerator } from './generator.js';
export interface OpenApiEndpointOptions {
    readonly router?: IRouter | undefined;
    readonly format?: 'json' | 'yaml' | 'auto' | undefined;
    readonly cacheDocument?: boolean | undefined;
}
/**
 * Creates an HTTP RouteHandler that serves the OpenAPI specification document.
 */
export declare function createOpenApiHandler(generator: OpenApiGenerator, options?: OpenApiEndpointOptions): RouteHandler;
//# sourceMappingURL=endpoint.d.ts.map