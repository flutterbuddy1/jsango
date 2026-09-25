import type { ModelStatic } from './types.js';
import type { ModelMetadata } from './metadata.js';
import type { Model } from './model.js';
import { MetadataError } from './errors.js';

export class ModelRegistry {
  private readonly models = new Map<string, ModelStatic>();

  public register<TModel extends Model>(modelClass: ModelStatic<TModel>): void {
    const name = modelClass.modelName;
    if (this.models.has(name)) {
      throw new MetadataError(`Model with name '${name}' is already registered in this registry.`);
    }
    this.models.set(name, modelClass);
  }

  public getModel<TModel extends Model = Model>(name: string): ModelStatic<TModel> | undefined {
    return this.models.get(name) as ModelStatic<TModel> | undefined;
  }

  public hasModel(name: string): boolean {
    return this.models.has(name);
  }

  public getAllModels(): readonly ModelStatic[] {
    return Object.freeze([...this.models.values()]);
  }

  public getMetadata(name: string): ModelMetadata | undefined {
    return this.models.get(name)?.metadata;
  }

  public clear(): void {
    this.models.clear();
  }
}

export const defaultModelRegistry = new ModelRegistry();

export function registerModel<TModel extends Model>(modelClass: ModelStatic<TModel>): void {
  defaultModelRegistry.register(modelClass);
}

export function getModel<TModel extends Model = Model>(
  name: string
): ModelStatic<TModel> | undefined {
  return defaultModelRegistry.getModel<TModel>(name);
}

export function getAllModels(): readonly ModelStatic[] {
  return defaultModelRegistry.getAllModels();
}

export function getDefaultRegistry(): ModelRegistry {
  return defaultModelRegistry;
}
