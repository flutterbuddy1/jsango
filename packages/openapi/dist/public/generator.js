import { OpenApiRegistry } from './registry.js';
import { DuplicateOperationIdError } from './errors.js';
import { SchemaBuilder } from './schema-builder.js';
export class OpenApiGenerator {
    info;
    version;
    servers;
    registry;
    includeAdmin;
    defaultSecurity;
    tags;
    constructor(options) {
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
            this.registry.registerSchema('ValidationErrorResponse', SchemaBuilder.validationErrorResponse());
        }
    }
    getRegistry() {
        return this.registry;
    }
    /**
     * Generates a deterministic OpenApiDocument from the router and registry.
     */
    generate(router) {
        const paths = {};
        const operationIds = new Map();
        if (router) {
            const routes = router.routes();
            for (const route of routes) {
                if (this.shouldSkipRoute(route)) {
                    continue;
                }
                const { path, pathParams } = this.normalizePathAndParams(route);
                const method = route.method.toLowerCase();
                if (method !== 'get' &&
                    method !== 'post' &&
                    method !== 'put' &&
                    method !== 'patch' &&
                    method !== 'delete' &&
                    method !== 'options' &&
                    method !== 'head') {
                    continue;
                }
                // Get metadata & overrides
                const routeMeta = route.metadata['openapi'] ?? {};
                const override = this.registry.getRouteOverride(route.method, route.path);
                const mergedMeta = { ...routeMeta, ...(override ?? {}) };
                // Determine operation ID
                const operationId = mergedMeta.operationId ?? route.routeName ?? this.generateOperationId(route.method, path);
                // Check for duplicates
                const existingOp = operationIds.get(operationId);
                if (existingOp && (existingOp.path !== path || existingOp.method !== route.method)) {
                    throw new DuplicateOperationIdError(operationId, existingOp.path, existingOp.method, path, route.method);
                }
                operationIds.set(operationId, { path, method: route.method });
                // Merge path parameters with metadata parameters
                const combinedParams = [
                    ...pathParams,
                    ...(mergedMeta.parameters ?? []).filter((p) => p.in !== 'path'),
                ];
                // Build operation
                const operation = {
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
                paths[path][method] = operation;
            }
        }
        // Sort paths alphabetically for deterministic generation
        const sortedPaths = {};
        for (const key of Object.keys(paths).sort()) {
            sortedPaths[key] = paths[key];
        }
        // Build components
        const components = this.buildComponents();
        // Collect tags
        const allTags = [...this.tags, ...this.registry.getAllTags()];
        const uniqueTags = Array.from(new Map(allTags.map((t) => [t.name, t])).values()).sort((a, b) => a.name.localeCompare(b.name));
        const doc = {
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
    shouldSkipRoute(route) {
        const meta = route.metadata['openapi'];
        if (meta?.hidden || meta?.excludeFromOpenApi) {
            return true;
        }
        // Exclude admin routes unless explicitly enabled
        if (!this.includeAdmin &&
            (route.path.startsWith('/admin') || route.metadata['admin'])) {
            return true;
        }
        return false;
    }
    /**
     * Normalizes router path syntax (`/users/:id<number>`) to OpenAPI syntax (`/users/{id}`)
     * and derives path parameter definitions from constraints.
     */
    normalizePathAndParams(route) {
        const pathParams = [];
        const normalized = route.path.replace(/:([a-zA-Z0-9_]+)(?:<([^>]+)>)?\??/g, (_, name, constraint) => {
            let schemaType = 'string';
            let schemaFormat = undefined;
            if (constraint) {
                if (constraint === 'number' || constraint === 'int' || constraint === 'integer') {
                    schemaType = 'integer';
                }
                else if (constraint === 'uuid') {
                    schemaType = 'string';
                    schemaFormat = 'uuid';
                }
                else if (constraint === 'slug') {
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
        });
        return { path: normalized, pathParams };
    }
    generateOperationId(method, path) {
        const cleaned = path.replace(/[{}]/g, '').split('/').filter(Boolean).join('_');
        return `${method.toLowerCase()}_${cleaned || 'root'}`;
    }
    defaultResponses(method) {
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
    buildComponents() {
        const schemas = {};
        const securitySchemes = {};
        const responses = {};
        const parameters = {};
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
        const hasAny = Object.keys(schemas).length > 0 ||
            Object.keys(securitySchemes).length > 0 ||
            Object.keys(responses).length > 0 ||
            Object.keys(parameters).length > 0;
        if (!hasAny)
            return undefined;
        return {
            ...(Object.keys(schemas).length > 0
                ? { schemas: schemas }
                : {}),
            ...(Object.keys(securitySchemes).length > 0
                ? {
                    securitySchemes: securitySchemes,
                }
                : {}),
            ...(Object.keys(responses).length > 0
                ? { responses: responses }
                : {}),
            ...(Object.keys(parameters).length > 0
                ? { parameters: parameters }
                : {}),
        };
    }
}
//# sourceMappingURL=generator.js.map