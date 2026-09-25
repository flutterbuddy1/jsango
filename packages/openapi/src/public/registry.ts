import type {
  OpenApiSchema,
  OpenApiSecurityScheme,
  OpenApiTag,
  OpenApiServer,
  OpenApiResponse,
  OpenApiParameter,
  OpenApiHeader,
  OpenApiRequestBody,
  OpenApiRouteMetadata,
} from './types.js';
import { ConflictingSchemaError } from './errors.js';

export class OpenApiRegistry {
  private readonly schemas = new Map<string, OpenApiSchema>();
  private readonly securitySchemes = new Map<string, OpenApiSecurityScheme>();
  private readonly tags = new Map<string, OpenApiTag>();
  private readonly servers: OpenApiServer[] = [];
  private readonly responses = new Map<string, OpenApiResponse>();
  private readonly parameters = new Map<string, OpenApiParameter>();
  private readonly headers = new Map<string, OpenApiHeader>();
  private readonly requestBodies = new Map<string, OpenApiRequestBody>();
  private readonly routeOverrides = new Map<string, OpenApiRouteMetadata>();

  /**
   * Registers a reusable component schema.
   * If a schema with the same name already exists, verifies structural compatibility.
   */
  public registerSchema(name: string, schema: OpenApiSchema): this {
    const existing = this.schemas.get(name);
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(schema)) {
        throw new ConflictingSchemaError(
          name,
          'A different schema is already registered with this name.'
        );
      }
      return this;
    }
    this.schemas.set(name, Object.freeze({ ...schema }));
    return this;
  }

  public getSchema(name: string): OpenApiSchema | undefined {
    return this.schemas.get(name);
  }

  public getAllSchemas(): ReadonlyMap<string, OpenApiSchema> {
    return this.schemas;
  }

  /**
   * Registers a security scheme (e.g. bearer, apiKey, etc.).
   */
  public registerSecurityScheme(name: string, scheme: OpenApiSecurityScheme): this {
    this.securitySchemes.set(name, Object.freeze({ ...scheme }));
    return this;
  }

  public getAllSecuritySchemes(): ReadonlyMap<string, OpenApiSecurityScheme> {
    return this.securitySchemes;
  }

  /**
   * Registers an OpenAPI tag with optional description.
   */
  public registerTag(tag: OpenApiTag): this {
    this.tags.set(tag.name, Object.freeze({ ...tag }));
    return this;
  }

  public getAllTags(): readonly OpenApiTag[] {
    return Array.from(this.tags.values());
  }

  /**
   * Registers a server target.
   */
  public registerServer(server: OpenApiServer): this {
    this.servers.push(Object.freeze({ ...server }));
    return this;
  }

  public getAllServers(): readonly OpenApiServer[] {
    return this.servers;
  }

  /**
   * Registers a reusable response component.
   */
  public registerResponse(name: string, response: OpenApiResponse): this {
    this.responses.set(name, Object.freeze({ ...response }));
    return this;
  }

  public getAllResponses(): ReadonlyMap<string, OpenApiResponse> {
    return this.responses;
  }

  /**
   * Registers a reusable parameter component.
   */
  public registerParameter(name: string, parameter: OpenApiParameter): this {
    this.parameters.set(name, Object.freeze({ ...parameter }));
    return this;
  }

  public getAllParameters(): ReadonlyMap<string, OpenApiParameter> {
    return this.parameters;
  }

  /**
   * Registers an explicit route metadata override for a specific method and path.
   */
  public registerRouteOverride(method: string, path: string, metadata: OpenApiRouteMetadata): this {
    const key = `${method.toUpperCase()} ${path}`;
    this.routeOverrides.set(key, Object.freeze({ ...metadata }));
    return this;
  }

  public getRouteOverride(method: string, path: string): OpenApiRouteMetadata | undefined {
    return this.routeOverrides.get(`${method.toUpperCase()} ${path}`);
  }

  public clear(): void {
    this.schemas.clear();
    this.securitySchemes.clear();
    this.tags.clear();
    this.servers.length = 0;
    this.responses.clear();
    this.parameters.clear();
    this.headers.clear();
    this.requestBodies.clear();
    this.routeOverrides.clear();
  }
}
