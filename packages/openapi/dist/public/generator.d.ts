import type { IRouter } from '@jsango/router';
import type { OpenApiDocument, OpenApiInfo, OpenApiVersion, OpenApiServer, OpenApiSecurityRequirement, OpenApiTag } from './types.js';
import { OpenApiRegistry } from './registry.js';
export interface OpenApiGeneratorOptions {
    readonly info: OpenApiInfo;
    readonly openapi?: OpenApiVersion | undefined;
    readonly servers?: readonly OpenApiServer[] | undefined;
    readonly registry?: OpenApiRegistry | undefined;
    readonly includeAdmin?: boolean | undefined;
    readonly defaultSecurity?: readonly OpenApiSecurityRequirement[] | undefined;
    readonly tags?: readonly OpenApiTag[] | undefined;
}
export declare class OpenApiGenerator {
    private readonly info;
    private readonly version;
    private readonly servers;
    private readonly registry;
    private readonly includeAdmin;
    private readonly defaultSecurity?;
    private readonly tags;
    constructor(options: OpenApiGeneratorOptions);
    getRegistry(): OpenApiRegistry;
    /**
     * Generates a deterministic OpenApiDocument from the router and registry.
     */
    generate(router?: IRouter): OpenApiDocument;
    private shouldSkipRoute;
    /**
     * Normalizes router path syntax (`/users/:id<number>`) to OpenAPI syntax (`/users/{id}`)
     * and derives path parameter definitions from constraints.
     */
    private normalizePathAndParams;
    private generateOperationId;
    private defaultResponses;
    private buildComponents;
}
//# sourceMappingURL=generator.d.ts.map