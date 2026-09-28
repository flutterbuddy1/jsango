import type { OpenApiSchema, OpenApiSecurityScheme, OpenApiTag, OpenApiServer, OpenApiResponse, OpenApiParameter, OpenApiRouteMetadata } from './types.js';
export declare class OpenApiRegistry {
    private readonly schemas;
    private readonly securitySchemes;
    private readonly tags;
    private readonly servers;
    private readonly responses;
    private readonly parameters;
    private readonly headers;
    private readonly requestBodies;
    private readonly routeOverrides;
    /**
     * Registers a reusable component schema.
     * If a schema with the same name already exists, verifies structural compatibility.
     */
    registerSchema(name: string, schema: OpenApiSchema): this;
    getSchema(name: string): OpenApiSchema | undefined;
    getAllSchemas(): ReadonlyMap<string, OpenApiSchema>;
    /**
     * Registers a security scheme (e.g. bearer, apiKey, etc.).
     */
    registerSecurityScheme(name: string, scheme: OpenApiSecurityScheme): this;
    getAllSecuritySchemes(): ReadonlyMap<string, OpenApiSecurityScheme>;
    /**
     * Registers an OpenAPI tag with optional description.
     */
    registerTag(tag: OpenApiTag): this;
    getAllTags(): readonly OpenApiTag[];
    /**
     * Registers a server target.
     */
    registerServer(server: OpenApiServer): this;
    getAllServers(): readonly OpenApiServer[];
    /**
     * Registers a reusable response component.
     */
    registerResponse(name: string, response: OpenApiResponse): this;
    getAllResponses(): ReadonlyMap<string, OpenApiResponse>;
    /**
     * Registers a reusable parameter component.
     */
    registerParameter(name: string, parameter: OpenApiParameter): this;
    getAllParameters(): ReadonlyMap<string, OpenApiParameter>;
    /**
     * Registers an explicit route metadata override for a specific method and path.
     */
    registerRouteOverride(method: string, path: string, metadata: OpenApiRouteMetadata): this;
    getRouteOverride(method: string, path: string): OpenApiRouteMetadata | undefined;
    clear(): void;
}
//# sourceMappingURL=registry.d.ts.map