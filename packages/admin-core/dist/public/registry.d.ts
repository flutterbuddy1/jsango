import type { ModelStatic } from '@jsango/orm';
import { AdminResource } from './resource.js';
import { AdminPage } from './pages.js';
import { AdminDashboard } from './dashboard.js';
import type { IAdminPlugin } from './plugins.js';
import type { AdminResourceOptions } from './types.js';
export declare class AdminRegistry {
    private readonly resources;
    private readonly modelToResourceId;
    private readonly pages;
    private readonly plugins;
    readonly dashboard: AdminDashboard;
    /**
     * Registers an AdminResource explicitly or derives it automatically from an ORM model.
     */
    register(modelOrResource: AdminResource | ModelStatic, customOptions?: AdminResourceOptions): AdminResource;
    /**
     * Unregisters a resource by ID.
     */
    unregister(resourceId: string): boolean;
    /**
     * Retrieves an AdminResource by ID or model name.
     */
    getResource(idOrModelName: string): AdminResource | undefined;
    /**
     * Checks if a resource is registered.
     */
    hasResource(idOrModelName: string): boolean;
    /**
     * Returns all registered admin resources.
     */
    getAllResources(): readonly AdminResource[];
    /**
     * Registers a custom Admin page.
     */
    registerPage(page: AdminPage): this;
    /**
     * Retrieves an Admin page by ID.
     */
    getPage(id: string): AdminPage | undefined;
    /**
     * Returns all registered admin pages.
     */
    getAllPages(): readonly AdminPage[];
    /**
     * Registers an Admin plugin.
     */
    registerPlugin(plugin: IAdminPlugin): Promise<void>;
    /**
     * Returns all registered plugins.
     */
    getPlugins(): readonly IAdminPlugin[];
    /**
     * Clears all registered entities.
     */
    clear(): void;
}
//# sourceMappingURL=registry.d.ts.map