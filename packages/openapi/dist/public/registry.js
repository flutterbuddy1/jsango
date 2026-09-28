import { ConflictingSchemaError } from './errors.js';
export class OpenApiRegistry {
    schemas = new Map();
    securitySchemes = new Map();
    tags = new Map();
    servers = [];
    responses = new Map();
    parameters = new Map();
    headers = new Map();
    requestBodies = new Map();
    routeOverrides = new Map();
    /**
     * Registers a reusable component schema.
     * If a schema with the same name already exists, verifies structural compatibility.
     */
    registerSchema(name, schema) {
        const existing = this.schemas.get(name);
        if (existing) {
            if (JSON.stringify(existing) !== JSON.stringify(schema)) {
                throw new ConflictingSchemaError(name, 'A different schema is already registered with this name.');
            }
            return this;
        }
        this.schemas.set(name, Object.freeze({ ...schema }));
        return this;
    }
    getSchema(name) {
        return this.schemas.get(name);
    }
    getAllSchemas() {
        return this.schemas;
    }
    /**
     * Registers a security scheme (e.g. bearer, apiKey, etc.).
     */
    registerSecurityScheme(name, scheme) {
        this.securitySchemes.set(name, Object.freeze({ ...scheme }));
        return this;
    }
    getAllSecuritySchemes() {
        return this.securitySchemes;
    }
    /**
     * Registers an OpenAPI tag with optional description.
     */
    registerTag(tag) {
        this.tags.set(tag.name, Object.freeze({ ...tag }));
        return this;
    }
    getAllTags() {
        return Array.from(this.tags.values());
    }
    /**
     * Registers a server target.
     */
    registerServer(server) {
        this.servers.push(Object.freeze({ ...server }));
        return this;
    }
    getAllServers() {
        return this.servers;
    }
    /**
     * Registers a reusable response component.
     */
    registerResponse(name, response) {
        this.responses.set(name, Object.freeze({ ...response }));
        return this;
    }
    getAllResponses() {
        return this.responses;
    }
    /**
     * Registers a reusable parameter component.
     */
    registerParameter(name, parameter) {
        this.parameters.set(name, Object.freeze({ ...parameter }));
        return this;
    }
    getAllParameters() {
        return this.parameters;
    }
    /**
     * Registers an explicit route metadata override for a specific method and path.
     */
    registerRouteOverride(method, path, metadata) {
        const key = `${method.toUpperCase()} ${path}`;
        this.routeOverrides.set(key, Object.freeze({ ...metadata }));
        return this;
    }
    getRouteOverride(method, path) {
        return this.routeOverrides.get(`${method.toUpperCase()} ${path}`);
    }
    clear() {
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
//# sourceMappingURL=registry.js.map