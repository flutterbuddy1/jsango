import type { ModelStatic } from './types.js';
import type { ModelMetadata } from './metadata.js';
import type { Model } from './model.js';
import { MetadataError } from './errors.js';

export class ModelRegistry {
  private readonly models = new Map<string, ModelStatic>();

  public register<TModel extends Model>(modelClass: ModelStatic<TModel>): void {
    const name = modelClass.modelName;
    const existing = this.models.get(name);
    if (existing && existing !== (modelClass as unknown as ModelStatic)) {
      // The same model module evaluated twice (e.g. loaded by both the CLI and the app, or after
      // a hot reload) re-registers with the same table: keep the newest definition.
      if (existing.metadata.table !== modelClass.metadata.table) {
        throw new MetadataError(
          `Model with name '${name}' is already registered in this registry (table '${existing.metadata.table}'). Model names must be unique.`
        );
      }
    }
    this.models.set(name, modelClass as unknown as ModelStatic);
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

const REGISTRY_KEY = Symbol.for('jsango.orm.defaultModelRegistry');
const registryHolder = globalThis as unknown as { [REGISTRY_KEY]?: ModelRegistry };

/**
 * Process-wide registry that `defineModel()` registers into. Stored on globalThis so the CLI and
 * the application share it even if the package is installed more than once.
 */
export const defaultModelRegistry: ModelRegistry = (registryHolder[REGISTRY_KEY] ??=
  new ModelRegistry());

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
