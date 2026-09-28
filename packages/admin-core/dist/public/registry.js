import { AdminResource } from './resource.js';
import { AutoResourceGenerator } from './auto-generator.js';
import { AdminDashboard } from './dashboard.js';
import { AdminRegistrationError } from './errors.js';
export class AdminRegistry {
    resources = new Map();
    modelToResourceId = new Map();
    pages = new Map();
    plugins = new Map();
    dashboard = new AdminDashboard();
    /**
     * Registers an AdminResource explicitly or derives it automatically from an ORM model.
     */
    register(modelOrResource, customOptions) {
        let resource;
        if (modelOrResource instanceof AdminResource) {
            resource = modelOrResource;
        }
        else if (typeof modelOrResource === 'function' && 'metadata' in modelOrResource) {
            const model = modelOrResource;
            if (customOptions) {
                resource = new AdminResource({
                    ...customOptions,
                    modelName: customOptions.modelName ?? model.metadata.name,
                    modelMetadata: model.metadata,
                });
            }
            else {
                resource = AutoResourceGenerator.generateFromModel(model.metadata);
            }
        }
        else {
            throw new AdminRegistrationError({
                code: 'ERR_ADMIN_INVALID_REGISTRATION',
                message: 'Invalid argument provided to admin.register(). Expected AdminResource or ModelStatic class.',
            });
        }
        if (this.resources.has(resource.id)) {
            throw new AdminRegistrationError({
                code: 'ERR_ADMIN_DUPLICATE_RESOURCE',
                message: `Admin resource with id "${resource.id}" is already registered.`,
                metadata: { resourceId: resource.id, modelName: resource.modelName },
            });
        }
        this.resources.set(resource.id, resource);
        this.modelToResourceId.set(resource.modelName.toLowerCase(), resource.id);
        return resource;
    }
    /**
     * Unregisters a resource by ID.
     */
    unregister(resourceId) {
        const resource = this.resources.get(resourceId);
        if (!resource) {
            return false;
        }
        this.resources.delete(resourceId);
        this.modelToResourceId.delete(resource.modelName.toLowerCase());
        return true;
    }
    /**
     * Retrieves an AdminResource by ID or model name.
     */
    getResource(idOrModelName) {
        const direct = this.resources.get(idOrModelName.toLowerCase());
        if (direct) {
            return direct;
        }
        const fromModel = this.modelToResourceId.get(idOrModelName.toLowerCase());
        if (fromModel) {
            return this.resources.get(fromModel);
        }
        return undefined;
    }
    /**
     * Checks if a resource is registered.
     */
    hasResource(idOrModelName) {
        return this.getResource(idOrModelName) !== undefined;
    }
    /**
     * Returns all registered admin resources.
     */
    getAllResources() {
        return [...this.resources.values()];
    }
    /**
     * Registers a custom Admin page.
     */
    registerPage(page) {
        if (this.pages.has(page.id)) {
            throw new AdminRegistrationError({
                code: 'ERR_ADMIN_DUPLICATE_PAGE',
                message: `Admin page with id "${page.id}" is already registered.`,
                metadata: { pageId: page.id },
            });
        }
        this.pages.set(page.id, page);
        return this;
    }
    /**
     * Retrieves an Admin page by ID.
     */
    getPage(id) {
        return this.pages.get(id);
    }
    /**
     * Returns all registered admin pages.
     */
    getAllPages() {
        return [...this.pages.values()];
    }
    /**
     * Registers an Admin plugin.
     */
    async registerPlugin(plugin) {
        if (this.plugins.has(plugin.id)) {
            throw new AdminRegistrationError({
                code: 'ERR_ADMIN_DUPLICATE_PLUGIN',
                message: `Admin plugin "${plugin.id}" is already registered.`,
            });
        }
        this.plugins.set(plugin.id, plugin);
        await plugin.register(this);
        if (plugin.boot) {
            await plugin.boot(this);
        }
    }
    /**
     * Returns all registered plugins.
     */
    getPlugins() {
        return [...this.plugins.values()];
    }
    /**
     * Clears all registered entities.
     */
    clear() {
        this.resources.clear();
        this.modelToResourceId.clear();
        this.pages.clear();
        this.plugins.clear();
    }
}
//# sourceMappingURL=registry.js.map