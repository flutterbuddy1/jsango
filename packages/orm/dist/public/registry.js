import { MetadataError } from './errors.js';
export class ModelRegistry {
    models = new Map();
    register(modelClass) {
        const name = modelClass.modelName;
        if (this.models.has(name)) {
            throw new MetadataError(`Model with name '${name}' is already registered in this registry.`);
        }
        this.models.set(name, modelClass);
    }
    getModel(name) {
        return this.models.get(name);
    }
    hasModel(name) {
        return this.models.has(name);
    }
    getAllModels() {
        return Object.freeze([...this.models.values()]);
    }
    getMetadata(name) {
        return this.models.get(name)?.metadata;
    }
    clear() {
        this.models.clear();
    }
}
export const defaultModelRegistry = new ModelRegistry();
export function registerModel(modelClass) {
    defaultModelRegistry.register(modelClass);
}
export function getModel(name) {
    return defaultModelRegistry.getModel(name);
}
export function getAllModels() {
    return defaultModelRegistry.getAllModels();
}
export function getDefaultRegistry() {
    return defaultModelRegistry;
}
//# sourceMappingURL=registry.js.map