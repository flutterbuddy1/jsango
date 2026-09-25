import type { IRouter, Route } from '@django-js/router';
import type {
  OpenApiDocument,
  OpenApiInfo,
  OpenApiVersion,
  OpenApiServer,
  OpenApiPaths,
  OpenApiPathItem,
  OpenApiOperation,
  OpenApiParameter,
  OpenApiComponents,
  OpenApiSecurityRequirement,
  OpenApiTag,
  OpenApiRouteMetadata,
} from './types.js';
import { OpenApiRegistry } from './registry.js';
import { DuplicateOperationIdError } from './errors.js';
import { SchemaBuilder } from './schema-builder.js';

export interface OpenApiGeneratorOptions {
  readonly info: OpenApiInfo;
  readonly openapi?: OpenApiVersion | undefined;
  readonly servers?: readonly OpenApiServer[] | undefined;
  readonly registry?: OpenApiRegistry | undefined;
  readonly includeAdmin?: boolean | undefined;
  readonly defaultSecurity?: readonly OpenApiSecurityRequirement[] | undefined;
  readonly tags?: readonly OpenApiTag[] | undefined;
}

export class OpenApiGenerator {
  private readonly info: OpenApiInfo;
  private readonly version: OpenApiVersion;
  private readonly servers: readonly OpenApiServer[];
  private readonly registry: OpenApiRegistry;
  private readonly includeAdmin: boolean;
  private readonly defaultSecurity?: readonly OpenApiSecurityRequirement[] | undefined;
  private readonly tags: readonly OpenApiTag[];

  constructor(options: OpenApiGeneratorOptions) {
    this.info = options.info;
    this.version = options.openapi ?? '3.1.0';
    this.servers = options.servers ?? [];
    this.registry = options.registry ?? new OpenApiRegistry();
    this.includeAdmin = options.includeAdmin ?? false;
    this.defaultSecurity = options.defaultSecurity;
    this.tags = options.tags ?? [];

    // Ensure standard error response schemas are registered in components
    if (!this.registry.getSchema('ErrorResponse')) {
      this.registry.registerSchema('ErrorResponse', SchemaBuilder.errorResponse());
    }
    if (!this.registry.getSchema('ValidationErrorResponse')) {
      this.registry.registerSchema(
        'ValidationErrorResponse',
        SchemaBuilder.validationErrorResponse()
      );
    }
  }

  public getRegistry(): OpenApiRegistry {
    return this.registry;
  }

  /**
   * Generates a deterministic OpenApiDocument from the router and registry.
   */
  public generate(router?: IRouter): OpenApiDocument {
    const paths: OpenApiPaths = {};
    const operationIds = new Map<string, { path: string; method: string }>();

    if (router) {
      const routes = router.routes();
      for (const route of routes) {
        if (this.shouldSkipRoute(route)) {
          continue;
        }

        const { path, pathParams } = this.normalizePathAndParams(route);
        const method = route.method.toLowerCase() as keyof OpenApiPathItem;

        if (
          method !== 'get' &&
          method !== 'post' &&
          method !== 'put' &&
          method !== 'patch' &&
          method !== 'delete' &&
          method !== 'options' &&
          method !== 'head'
        ) {
          continue;
        }

        // Get metadata & overrides
        const routeMeta = (route.metadata['openapi'] as OpenApiRouteMetadata | undefined) ?? {};
        const override = this.registry.getRouteOverride(route.method, route.path);
        const mergedMeta: OpenApiRouteMetadata = { ...routeMeta, ...(override ?? {}) };

        // Determine operation ID
        const operationId =
          mergedMeta.operationId ?? route.routeName ?? this.generateOperationId(route.method, path);

        // Check for duplicates
        const existingOp = operationIds.get(operationId);
        if (existingOp && (existingOp.path !== path || existingOp.method !== route.method)) {
          throw new DuplicateOperationIdError(
            operationId,
            existingOp.path,
            existingOp.method,
            path,
            route.method
          );
        }
        operationIds.set(operationId, { path, method: route.method });

        // Merge path parameters with metadata parameters
        const combinedParams: OpenApiParameter[] = [
          ...pathParams,
          ...(mergedMeta.parameters ?? []).filter((p) => p.in !== 'path'),
        ];

        // Build operation
        const operation: OpenApiOperation = {
          summary: mergedMeta.summary ?? `${route.method} ${path}`,
          description: mergedMeta.description,
          operationId,
          tags: mergedMeta.tags,
          deprecated: mergedMeta.deprecated,
          parameters: combinedParams.length > 0 ? combinedParams : undefined,
          requestBody: mergedMeta.requestBody,
          responses: mergedMeta.responses ?? this.defaultResponses(route.method),
          security: mergedMeta.security ?? this.defaultSecurity,
        };

        if (!paths[path]) {
          paths[path] = {};
        }

        (paths[path] as Record<string, unknown>)[method] = operation;
      }
    }

    // Sort paths alphabetically for deterministic generation
    const sortedPaths: OpenApiPaths = {};
    for (const key of Object.keys(paths).sort()) {
      sortedPaths[key] = paths[key]!;
    }

    // Build components
    const components = this.buildComponents();

    // Collect tags
    const allTags = [...this.tags, ...this.registry.getAllTags()];
    const uniqueTags = Array.from(new Map(allTags.map((t) => [t.name, t])).values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const doc: OpenApiDocument = {
      openapi: this.version,
      info: this.info,
      ...(this.servers.length > 0 || this.registry.getAllServers().length > 0
        ? { servers: [...this.servers, ...this.registry.getAllServers()] }
        : {}),
      paths: sortedPaths,
      ...(components ? { components } : {}),
      ...(this.defaultSecurity ? { security: this.defaultSecurity } : {}),
      ...(uniqueTags.length > 0 ? { tags: uniqueTags } : {}),
    };

    return doc;
  }

  private shouldSkipRoute(route: Route): boolean {
    const meta = route.metadata['openapi'] as OpenApiRouteMetadata | undefined;
    if (meta?.hidden || meta?.excludeFromOpenApi) {
      return true;
    }

    // Exclude admin routes unless explicitly enabled
    if (
      !this.includeAdmin &&
      (route.path.startsWith('/admin') || (route.metadata['admin'] as boolean))
    ) {
      return true;
    }

    return false;
  }

  /**
   * Normalizes router path syntax (`/users/:id<number>`) to OpenAPI syntax (`/users/{id}`)
   * and derives path parameter definitions from constraints.
   */
  private normalizePathAndParams(route: Route): { path: string; pathParams: OpenApiParameter[] } {
    const pathParams: OpenApiParameter[] = [];
    const normalized = route.path.replace(
      /:([a-zA-Z0-9_]+)(?:<([^>]+)>)?\??/g,
      (_, name: string, constraint?: string) => {
        let schemaType = 'string';
        let schemaFormat: string | undefined = undefined;

        if (constraint) {
          if (constraint === 'number' || constraint === 'int' || constraint === 'integer') {
            schemaType = 'integer';
          } else if (constraint === 'uuid') {
            schemaType = 'string';
            schemaFormat = 'uuid';
          } else if (constraint === 'slug') {
            schemaType = 'string';
          }
        }

        pathParams.push({
          name,
          in: 'path',
          required: true,
          schema: {
            type: schemaType,
            ...(schemaFormat ? { format: schemaFormat } : {}),
          },
        });

        return `{${name}}`;
      }
    );

    return { path: normalized, pathParams };
  }

  private generateOperationId(method: string, path: string): string {
    const cleaned = path.replace(/[{}]/g, '').split('/').filter(Boolean).join('_');
    return `${method.toLowerCase()}_${cleaned || 'root'}`;
  }

  private defaultResponses(method: string): Record<string, { description: string }> {
    const successStatus = method.toUpperCase() === 'POST' ? '201' : '200';
    return {
      [successStatus]: {
        description: 'Successful response',
      },
      '400': {
        description: 'Bad Request',
      },
      '500': {
        description: 'Internal Server Error',
      },
    };
  }

  private buildComponents(): OpenApiComponents | undefined {
    const schemas: Record<string, unknown> = {};
    const securitySchemes: Record<string, unknown> = {};
    const responses: Record<string, unknown> = {};
    const parameters: Record<string, unknown> = {};

    for (const [key, schema] of this.registry.getAllSchemas().entries()) {
      schemas[key] = schema;
    }
    for (const [key, scheme] of this.registry.getAllSecuritySchemes().entries()) {
      securitySchemes[key] = scheme;
    }
    for (const [key, response] of this.registry.getAllResponses().entries()) {
      responses[key] = response;
    }
    for (const [key, param] of this.registry.getAllParameters().entries()) {
      parameters[key] = param;
    }

    const hasAny =
      Object.keys(schemas).length > 0 ||
      Object.keys(securitySchemes).length > 0 ||
      Object.keys(responses).length > 0 ||
      Object.keys(parameters).length > 0;

    if (!hasAny) return undefined;

    return {
      ...(Object.keys(schemas).length > 0
        ? { schemas: schemas as Record<string, import('./types.js').OpenApiSchema> }
        : {}),
      ...(Object.keys(securitySchemes).length > 0
        ? {
            securitySchemes: securitySchemes as Record<
              string,
              import('./types.js').OpenApiSecurityScheme
            >,
          }
        : {}),
      ...(Object.keys(responses).length > 0
        ? { responses: responses as Record<string, import('./types.js').OpenApiResponse> }
        : {}),
      ...(Object.keys(parameters).length > 0
        ? { parameters: parameters as Record<string, import('./types.js').OpenApiParameter> }
        : {}),
    };
  }
}
