/**
 * Custom Extension & Plugin architecture for @jsango/admin-ui
 */
export class AdminUiPluginRegistry {
    plugins = new Map();
    fieldRenderers = new Map();
    registerPlugin(plugin) {
        this.plugins.set(plugin.id, plugin);
        if (plugin.customFieldRenderers) {
            for (const [fieldType, renderer] of Object.entries(plugin.customFieldRenderers)) {
                this.fieldRenderers.set(fieldType, renderer);
            }
        }
        return this;
    }
    getPlugin(id) {
        return this.plugins.get(id);
    }
    getPlugins() {
        return [...this.plugins.values()];
    }
    getFieldRenderer(fieldType) {
        return this.fieldRenderers.get(fieldType);
    }
    clear() {
        this.plugins.clear();
        this.fieldRenderers.clear();
    }
}
//# sourceMappingURL=index.js.map