import type { ModelStatic } from './types.js';
import type { ModelMetadata } from './metadata.js';
import type { Model } from './model.js';
export declare class ModelRegistry {
    private readonly models;
    register<TModel extends Model>(modelClass: ModelStatic<TModel>): void;
    getModel<TModel extends Model = Model>(name: string): ModelStatic<TModel> | undefined;
    hasModel(name: string): boolean;
    getAllModels(): readonly ModelStatic[];
    getMetadata(name: string): ModelMetadata | undefined;
    clear(): void;
}
export declare const defaultModelRegistry: ModelRegistry;
export declare function registerModel<TModel extends Model>(modelClass: ModelStatic<TModel>): void;
export declare function getModel<TModel extends Model = Model>(name: string): ModelStatic<TModel> | undefined;
export declare function getAllModels(): readonly ModelStatic[];
export declare function getDefaultRegistry(): ModelRegistry;
//# sourceMappingURL=registry.d.ts.map